// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { accountSources, mailOwned } from '../src/apps/investments/imports/domain/accountIntake'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import type { ReportQuestion } from '../src/apps/investments/imports/domain/importQuestions'
import { bookingKey, isAskedKey, isReportKey } from '../src/apps/investments/imports/domain/reportKey'
import { askedRowStart } from '../src/apps/investments/mail/domain/askedRowStart'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { newestReportDay, reportNews } from '../src/apps/investments/mail/domain/mailReview'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { textsOf, transactionDraft } from '../src/apps/investments/transactions/domain/transactionDraft'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { USD, account, book, instrument, rateBookOf, trade } from './fixtures/investments'

const DAY = parseCivilDate('2026-10-05')!
const SINCE = parseCivilDate('2026-01-01')!
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', [{ source: 'mail', from: SINCE }])
const ABC = instrument('abc', { name: 'Example Tech', isin: 'XX000000ABC1', currency: USD })
const DEF = instrument('def', { name: 'Example Dividend Co', isin: 'US000000DEF2', currency: USD })
const RATES = rateBookOf(new Map([[USD, [['2026-10-01', '1.10']]]]))
const ANSWERS: WorkbookAnswers = {
  ...NO_ANSWERS,
  accounts: new Map([['U0000001', ACCOUNT]]),
  instruments: new Map([
    ['XX000000ABC1', ABC],
    ['US000000DEF2', DEF],
  ]),
}

/** The made-up report of a day with a row of every section Kuna does not read yet, as the mail brings it. */
function unseenRows(days: readonly CivilDate[] = [DAY]): WorkbookRows {
  const bytes = new TextEncoder().encode(sampleFlexReport(days, 'unseen')).buffer as ArrayBuffer
  const read = readRecipeFile(IBKR_FLEX_RECIPE, bytes)
  if (read.kind !== 'read') throw new Error(`It did not read: ${read.misfit.kind}`)
  const run = runRecipe(IBKR_FLEX_RECIPE, read)
  if (run.kind !== 'read') throw new Error(`It does not fit: ${run.misfit.kind}`)
  return reportRows(IBKR_FLEX_RECIPE, [{ fileName: 'report.xml', run }], { leftOut: [] }, { kind: 'mailed', since: SINCE })
}

/** The report's rows already imported, with the holding it sells bought before. */
function imported(): InvestmentBook {
  const kept = book({ accounts: [ACCOUNT], instruments: [ABC, DEF], trades: [trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1')] })
  return workbookDryRun(unseenRows(), { book: kept, rates: RATES, answers: ANSWERS }).planned
}

function questionsOf(records: InvestmentBook): readonly ReportQuestion[] {
  return workbookDryRun(unseenRows(), { book: records, rates: RATES, answers: NO_ANSWERS }).report!.asked
}

/** The first question of a section, or of the section's rows whose buy or sell reads `buySell`. */
function questionIn(records: InvestmentBook, section: string, buySell?: string): ReportQuestion {
  return questionsOf(records).find((question) => question.section === section && (buySell === undefined || new Map(question.shown).get('buySell') === buySell))!
}

describe('the form a question of IBKR’s report starts', () => {
  const records = imported()

  it.each([
    ['Trades', 'buy', { date: DAY, account: ACCOUNT.id, instrument: ABC.id, quantity: '1', currency: USD }],
    ['Cash Transactions', 'income', { date: DAY, account: ACCOUNT.id }],
    ['Transaction Taxes', 'fee', { date: DAY, account: ACCOUNT.id, instrument: ABC.id, amount: '0.50', currency: USD }],
    ['Transfers', 'transfer', { date: DAY, account: '', toAccount: ACCOUNT.id, instrument: DEF.id, moves: 'units', quantity: '5' }],
    ['Corporate Actions', 'split', { date: DAY, instrument: ABC.id }],
  ] as const)('starts a row of %s as a %s on its day', (section, happened, texts) => {
    const start = askedRowStart(questionIn(records, section, section === 'Trades' ? 'BUY' : undefined), records)
    expect(start?.happened).toBe(happened)
    expect(start?.texts).toMatchObject(texts)
  })

  it('starts no form for a cancelled buy, whose units go out, so it keeps only Hold and Leave out', () => {
    expect(askedRowStart(questionIn(records, 'Trades', 'BUY (Ca.)'), records)).toBeNull()
  })

  it('leaves the account blank when the mail fills no account or more than one', () => {
    const twoMailed = { ...records, accounts: [ACCOUNT, account('second', 'Second', [{ source: 'mail', from: SINCE }])] }
    expect(askedRowStart(questionIn(records, 'Corporate Actions'), twoMailed)?.texts).not.toHaveProperty('account')
    expect(askedRowStart(questionIn(records, 'Trades', 'BUY'), twoMailed)?.texts).toMatchObject({ account: '' })
  })
})

describe('a question booked from IBKR’s report', () => {
  const records = imported()
  const question = questionIn(records, 'Transaction Taxes')
  const key = bookingKey(IBKR_FLEX_RECIPE.id, question)

  /** The fee the person books from the tax row, saved as the form drafts it. */
  function booked(): InvestmentBook {
    const start = askedRowStart(question, records)!
    // The dialog fills the ECB's rate of the day, as it does for any new record.
    const texts = { ...textsOf(null, { happened: start.happened, instrument: null, today: DAY, texts: start.texts }, records), rate: '1.10' }
    const draft = transactionDraft(texts, records, 'booked-tax', [key])
    if (draft.record?.kind !== 'cash-movement') throw new Error(`The form did not draft a fee: ${JSON.stringify(draft.faults)}`)
    return { ...records, cashMovements: [...records.cashMovements, draft.record.record] }
  }

  it('keeps a key shaped like the report’s, so it lands on the account the mail fills', () => {
    expect(key).toBe(`${IBKR_FLEX_RECIPE.id}:asked:${question.key}`)
    expect(isReportKey(key) && isAskedKey(key)).toBe(true)
    expect(mailOwned(accountSources(records), { id: ACCOUNT.id, accounts: [ACCOUNT.id], date: DAY, importKeys: [key] })).toBeNull()
    expect(booked().cashMovements.at(-1)!.importKeys).toEqual([key])
  })

  it('is not asked again once booked, and comes back once the record is gone, as Undo leaves it', () => {
    expect(questionsOf(booked()).map((asked) => asked.key)).not.toContain(question.key)
    expect(reportNews(unseenRows(), booked(), RATES).asked).toBe(questionsOf(records).length - 1)
    expect(questionsOf(records).map((asked) => asked.key)).toContain(question.key)
  })

  it('neither moves the newest report day nor makes an account read as filled by the mail', () => {
    const old = { ...booked(), cashMovements: booked().cashMovements.map((movement) => (movement.importKeys.includes(key) ? { ...movement, date: parseCivilDate('2027-01-04')! } : movement)) }
    expect(newestReportDay(old)).toBe(newestReportDay(records))
    const unsaid = { ...old, accounts: [{ ...ACCOUNT, sources: null }], mailReaders: [{ ...old.mailReaders[0]!, since: SINCE }] }
    const onlyBooked = { ...unsaid, trades: [], income: [], exchanges: [], transfers: [], cashMovements: unsaid.cashMovements.filter((movement) => movement.importKeys.includes(key)) }
    expect(accountSources(onlyBooked).get(ACCOUNT.id)).toEqual([{ source: 'by-hand', from: null }])
  })

  it('is neither asked about nor listed as gone by a workbook import', () => {
    const workbook: WorkbookRows = { rows: [], skipped: [], rounded: [] }
    const run = workbookDryRun(workbook, { book: booked(), rates: RATES, answers: NO_ANSWERS })
    expect(run.gone).toEqual([])
    expect(run.questions.lookAlikes).toEqual([])
  })

  it('offers no Book for a changed row a record already holds, which keeps Hold and Leave out', () => {
    const changed: ReportQuestion = { ...question, key: records.trades.at(-1)!.importKeys[0]!, why: { kind: 'changed' }, booking: null }
    expect(bookingKey(IBKR_FLEX_RECIPE.id, changed)).toBe(changed.key)
  })
})
