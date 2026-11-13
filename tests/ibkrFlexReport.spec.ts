// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { DryRunEntry, WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { readMailReports } from '../src/apps/investments/mail/application/mailReports'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { newestReportDay, reportNews } from '../src/apps/investments/mail/domain/mailReview'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import type { SampleFlexShape } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { WORKBOOK_TYPES } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalOfText } from '../src/shared/money/decimal'
import type { Decimal } from '../src/shared/money/decimal'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { fileNameFits, readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { USD, account, book, instrument, rateBookOf, trade } from './fixtures/investments'
import { testMailbox } from './fixtures/mailbox'

const DAY = parseCivilDate('2026-10-05')!
const NEXT_DAY = parseCivilDate('2026-10-06')!
const SINCE = parseCivilDate('2026-01-01')!
const MAILED = { kind: 'mailed', since: SINCE } as const
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', { rowsFrom: 'mail', startsOn: SINCE })
const ABC = instrument('abc', { name: 'Example Tech', isin: 'XX000000ABC1', currency: USD })
const DEF = instrument('def', { name: 'Example Dividend Co', isin: 'US000000DEF2', currency: USD })
const RATES = rateBookOf(new Map([[USD, [['2026-10-01', '1.10']]]]))
const EUR = EURO

function decimal(text: string): Decimal {
  return decimalOfText(text)!
}

function fileOf(days: readonly CivilDate[], shape: SampleFlexShape = 'plain') {
  const bytes = new TextEncoder().encode(sampleFlexReport(days, shape)).buffer as ArrayBuffer
  const read = readRecipeFile(IBKR_FLEX_RECIPE, bytes)
  if (read.kind !== 'read') throw new Error(`It did not read: ${read.misfit.kind}`)
  const run = runRecipe(IBKR_FLEX_RECIPE, read.rows)
  if (run.kind !== 'read') throw new Error(`It does not fit: ${run.misfit.kind}`)
  return { fileName: 'report.xml', run }
}

function rowsOf(days: readonly CivilDate[] = [DAY], shape: SampleFlexShape = 'plain'): WorkbookRows {
  return reportRows(IBKR_FLEX_RECIPE, [fileOf(days, shape)], { leftOut: [] }, MAILED)
}

const ANSWERS: WorkbookAnswers = {
  ...NO_ANSWERS,
  accounts: new Map([['U0000001', ACCOUNT]]),
  instruments: new Map([
    ['XX000000ABC1', ABC],
    ['US000000DEF2', DEF],
  ]),
}

/** Units of the holding the report sells were bought before it. */
function kept() {
  return book({ accounts: [ACCOUNT], instruments: [ABC, DEF], trades: [trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1')] })
}

function recordsOf(entries: readonly DryRunEntry[]) {
  return entries.flatMap((entry) => (entry.outcome.kind === 'new' ? [entry.outcome.imported] : []))
}

describe("IBKR's built-in recipe", () => {
  it('names only kinds of row Kuna books', () => {
    const kinds = IBKR_FLEX_RECIPE.sections.flatMap((section) => section.kinds.map((kind) => kind.kind))
    expect(kinds.filter((kind) => !(WORKBOOK_TYPES as readonly string[]).includes(kind))).toEqual([])
  })

  it('reads the made-up report into records of every kind seen so far, passing over rows of other levels', () => {
    const run = workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS })
    const records = recordsOf(run.entries)
    expect(records.map((imported) => imported.kind).sort()).toEqual(['cash-movement', 'cash-movement', 'cash-movement', 'cash-movement', 'exchange', 'income', 'income', 'trade', 'trade'].sort())
    expect(run.entries.filter((entry) => entry.outcome.kind === 'waiting')).toEqual([])
    expect(run.skipped).toEqual([])
  })

  it('keeps a fractional quantity, and takes the fee from the net cash', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const buy = records.find((imported) => imported.kind === 'trade' && imported.record.side === 'buy')
    expect(buy?.record).toMatchObject({ quantity: decimal('1.2345'), price: decimal('100.5'), fees: decimal('0.35'), date: DAY })
  })

  it('books a commission in another currency as its own fee, leaving its trade to the cash it moved', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const sale = records.find((imported) => imported.kind === 'trade' && imported.record.side === 'sell')
    expect(sale?.record).toMatchObject({ quantity: decimal('0.5'), fees: decimal('0') })
    const fee = records.find((imported) => imported.kind === 'cash-movement' && imported.record.kind === 'fee' && imported.record.currency === EUR)
    expect(fee?.record).toMatchObject({ amount: decimal('0.25'), note: expect.stringContaining('ABC') })
  })

  it('books a CASH row with no ISIN as an exchange, each leg after fees', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    expect(records.find((imported) => imported.kind === 'exchange')?.record).toMatchObject({
      sold: decimal('552'),
      soldCurrency: USD,
      bought: decimal('500'),
      boughtCurrency: EUR,
      fees: { amount: decimal('2'), currency: USD },
    })
  })

  it('pairs withholding with its dividend by action id, keeping its ex date, pay date, country and type', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    expect(records.find((imported) => imported.kind === 'income' && imported.record.kind === 'dividend')?.record).toMatchObject({
      gross: decimal('30'),
      withheld: decimal('4.5'),
      instrument: DEF.id,
      dividend: { exDate: '2026-09-25', payDate: '2026-10-05', sourceCountry: 'US', dividendType: 'Ordinary Dividend' },
    })
  })

  it('pairs withholding with no ISIN with the broker interest of its day and currency', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    expect(records.find((imported) => imported.kind === 'income' && imported.record.kind === 'interest')?.record).toMatchObject({ gross: decimal('2.1'), withheld: decimal('0.21'), instrument: null })
  })

  it('books deposits, withdrawals and other fees by the sign of their amount', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const movements = records.flatMap((imported) => (imported.kind === 'cash-movement' ? [[imported.record.kind, imported.record.amount, imported.record.currency]] : []))
    expect(movements).toEqual(
      expect.arrayContaining([
        ['deposit', decimal('1000'), EUR],
        ['withdrawal', decimal('200'), EUR],
        ['fee', decimal('1.5'), USD],
      ]),
    )
  })

  it('holds back every kind of row not seen yet, and books the rest', () => {
    const rows = rowsOf([DAY], 'unseen')
    const asked = rows.report?.asked ?? []
    expect(asked.map((row) => [row.section, row.why.kind]).sort()).toEqual(
      [
        ['Trades', 'no-kind'],
        ['Trades', 'no-kind'],
        ['Cash Transactions', 'no-kind'],
        ['Transaction Taxes', 'no-kind'],
        ['Corporate Actions', 'no-kind'],
        ['Transfers', 'no-kind'],
      ].sort(),
    )
    const run = workbookDryRun(rows, { book: kept(), rates: RATES, answers: ANSWERS })
    expect(recordsOf(run.entries)).toHaveLength(9)
    expect(run.report?.asked).toHaveLength(6)
  })

  it.each([
    ['no-trades-section', { kind: 'no-section', section: 'Trades' }],
    ['no-transaction-id', { kind: 'no-column', section: 'Trades', column: 'transactionID' }],
  ] as const)('fails a report that no longer fits, reading nothing: %s', (shape, misfit) => {
    const bytes = new TextEncoder().encode(sampleFlexReport([DAY], shape)).buffer as ArrayBuffer
    const read = readRecipeFile(IBKR_FLEX_RECIPE, bytes)
    expect(read.kind === 'read' && runRecipe(IBKR_FLEX_RECIPE, read.rows)).toEqual({ kind: 'misfit', misfit })
  })
})

describe('a rolling report', () => {
  it('counts a row two files share once', () => {
    const rows = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY]), fileOf([DAY, NEXT_DAY])], { leftOut: [] }, MAILED)
    const once = rowsOf([DAY])
    const twice = rowsOf([DAY, NEXT_DAY])
    expect(rows.rows.map((row) => row.key).sort()).toEqual(twice.rows.map((row) => row.key).sort())
    expect(twice.rows).toHaveLength(once.rows.length * 2)
  })

  it('keeps the same keys from an overlapping file, so a second import adds nothing', () => {
    const first = workbookDryRun(rowsOf([DAY]), { book: kept(), rates: RATES, answers: ANSWERS })
    const second = workbookDryRun(rowsOf([DAY, NEXT_DAY]), { book: first.planned, rates: RATES, answers: ANSWERS })
    expect(second.entries.filter((entry) => entry.outcome.kind === 'in-kuna')).toHaveLength(first.entries.length)
    expect(recordsOf(second.entries)).toHaveLength(first.entries.length)
  })

  it('lists nothing as gone, since absence from a rolling file means nothing', () => {
    const first = workbookDryRun(rowsOf([DAY]), { book: kept(), rates: RATES, answers: ANSWERS })
    const later = workbookDryRun(rowsOf([NEXT_DAY]), { book: first.planned, rates: RATES, answers: ANSWERS })
    expect(later.gone).toEqual([])
    const overlapping = workbookDryRun(rowsOf([DAY, NEXT_DAY]), { book: first.planned, rates: RATES, answers: ANSWERS })
    expect(overlapping.gone).toEqual([])
  })

  it('finds its account from an older record of the same report, however little a file overlaps', () => {
    const first = workbookDryRun(rowsOf([DAY]), { book: kept(), rates: RATES, answers: ANSWERS })
    const later = workbookDryRun(rowsOf([NEXT_DAY]), { book: first.planned, rates: RATES, answers: NO_ANSWERS })
    expect(later.questions.accounts).toMatchObject([{ account: 'U0000001', known: ACCOUNT.id }])
  })

  it('asks about a row a later file writes differently, and books neither copy', () => {
    const original = fileOf([DAY])
    const edited = { ...original, run: { ...original.run, rows: original.run.rows.map((row) => (row.kind === 'BUY' ? { ...row, facts: `${row.facts}|changed` } : row)) } }
    const rows = reportRows(IBKR_FLEX_RECIPE, [original, edited], { leftOut: [] }, MAILED)
    expect(rows.rows.filter((row) => row.type === 'BUY')).toEqual([])
    expect(rows.report?.asked).toMatchObject([{ section: 'Trades', why: { kind: 'changed' } }])
  })

  it('stops asking about a row the person left out', () => {
    const asked = rowsOf([DAY], 'unseen').report!.asked
    const rows = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY], 'unseen')], { leftOut: [asked[0]!.key] }, MAILED)
    expect(rows.report?.asked).toHaveLength(asked.length - 1)
  })

  it('says a dividend accepted one day waits again once its withholding arrives in the next file', () => {
    const whole = fileOf([DAY])
    const noTax = { ...whole, run: { ...whole.run, rows: whole.run.rows.filter((row) => !(row.kind === 'WITHHOLDING TAX' && row.texts.isin !== null)) } }
    const accepted = workbookDryRun(reportRows(IBKR_FLEX_RECIPE, [noTax], { leftOut: [] }, MAILED), { book: kept(), rates: RATES, answers: ANSWERS }).planned
    const nextDay = reportRows(IBKR_FLEX_RECIPE, [noTax, whole], { leftOut: [] }, MAILED)
    expect(reportNews(nextDay, accepted, RATES)).toEqual({ fresh: 0, changed: 1, asked: 0 })
  })

  it('leaves out questions dated before the earliest start day of the accounts the mail fills, and counts them as left out', () => {
    const all = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY, NEXT_DAY], 'unseen')], { leftOut: [] }, MAILED)
    const later = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY, NEXT_DAY], 'unseen')], { leftOut: [] }, { kind: 'mailed', since: NEXT_DAY })
    expect(all.report?.asked).toHaveLength(6)
    expect(later.report?.asked).toEqual([])
    expect(later.report?.beforeStart).toBe(6)
  })

  it("leaves out a mailed report's rows before their account's start day, and says how many", () => {
    const later = account('kuna-ibkr', 'Kuna IBKR', { rowsFrom: 'mail', startsOn: NEXT_DAY })
    const rows = rowsOf([DAY, NEXT_DAY])
    const dryRun = workbookDryRun(rows, { book: book({ accounts: [later], instruments: [ABC, DEF] }), rates: RATES, answers: { ...ANSWERS, accounts: new Map([['U0000001', later]]) } })
    expect(dryRun.entries.length).toBeGreaterThan(0)
    expect(dryRun.entries.every((entry) => entry.rows.every((row) => row.date === NEXT_DAY))).toBe(true)
    expect(dryRun.report?.beforeStart).toBe(rows.rows.filter((row) => row.date === DAY).length)
  })

  it('leaves out every mailed row of an account kept by hand, and says how many', () => {
    const byHand = account('kuna-ibkr', 'Kuna IBKR')
    const rows = rowsOf([DAY])
    const dryRun = workbookDryRun(rows, { book: book({ accounts: [byHand], instruments: [ABC, DEF] }), rates: RATES, answers: { ...ANSWERS, accounts: new Map([['U0000001', byHand]]) } })
    expect(dryRun.entries).toEqual([])
    expect(dryRun.report).toMatchObject({ byHand: rows.rows.length, beforeStart: 0 })
  })

  it('takes every row of an uploaded report, since an upload counts as by hand', () => {
    const later = account('kuna-ibkr', 'Kuna IBKR', { rowsFrom: 'mail', startsOn: NEXT_DAY })
    const rows = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY, NEXT_DAY])], { leftOut: [] }, { kind: 'uploaded' })
    const dryRun = workbookDryRun(rows, { book: book({ accounts: [later], instruments: [ABC, DEF] }), rates: RATES, answers: { ...ANSWERS, accounts: new Map([['U0000001', later]]) } })
    expect(dryRun.entries.some((entry) => entry.rows[0].date === DAY)).toBe(true)
    expect(dryRun.report).toMatchObject({ mailed: false, beforeStart: 0, byHand: 0 })
  })

  it('holds a record back when tax withheld arrives after its dividend was booked, rather than book it twice or lose the tax', () => {
    const whole = rowsOf([DAY])
    const noTax = { ...whole, rows: whole.rows.filter((row) => !(row.type === 'WITHHOLDING TAX' && row.isin !== '')) }
    const first = workbookDryRun(noTax, { book: kept(), rates: RATES, answers: ANSWERS })
    const later = workbookDryRun(whole, { book: first.planned, rates: RATES, answers: ANSWERS })
    const dividend = later.entries.find((entry) => entry.rows[0].type === 'DIVIDEND')
    expect(dividend?.outcome).toEqual({ kind: 'waiting', reason: { kind: 'differs-from-kuna' } })
    expect(recordsOf(later.entries)).toEqual([])
  })

  it('leaves a withholding row with no dividend in any file waiting', () => {
    const whole = rowsOf([DAY])
    const lone = { ...whole, rows: whole.rows.filter((row) => row.type !== 'DIVIDEND') }
    const run = workbookDryRun(lone, { book: kept(), rates: RATES, answers: ANSWERS })
    expect(run.entries.filter((entry) => entry.outcome.kind === 'waiting').map((entry) => entry.outcome)).toEqual([{ kind: 'waiting', reason: { kind: 'no-partner' } }])
  })

  it('says what waits for the person, and nothing once all of it is booked', () => {
    const rows = rowsOf([DAY], 'unseen')
    expect(reportNews(rows, kept(), RATES)).toEqual({ fresh: 9, changed: 0, asked: 6 })
    const planned = workbookDryRun(rows, { book: kept(), rates: RATES, answers: ANSWERS }).planned
    expect(reportNews(rows, planned, RATES)).toEqual({ fresh: 0, changed: 0, asked: 6 })
    expect(newestReportDay(planned)).toBe(DAY)
    expect(newestReportDay(kept())).toBeNull()
  })
})

describe('the mail step for a report', () => {
  const reader = { id: 'mail-reader-1', recipe: IBKR_FLEX_RECIPE.id, on: true, senders: ['reports@broker.example.com'], subject: 'Flex', contents: 'Activity', since: SINCE, leftOut: [] } as never

  function ports(mails: Parameters<typeof testMailbox>[0], known = new Map()) {
    const mailbox = testMailbox(mails)
    return {
      mailbox,
      plan: readMailReports({
        mailbox,
        recipe: IBKR_FLEX_RECIPE,
        reader,
        sinceStart: Date.parse('2026-10-01T00:00:00Z'),
        newest: null,
        fits: (name) => fileNameFits(IBKR_FLEX_RECIPE, name),
        readFile: (bytes) => readRecipeFile(IBKR_FLEX_RECIPE, bytes),
        known,
      }),
    }
  }

  it('searches by sender, subject and contents, for mail with an attachment, oldest mail first', async () => {
    const { plan, mailbox } = ports([
      { id: 'b', subject: 'Flex report', at: '2026-10-07T06:00:00Z', attachments: [['b.xml', sampleFlexReport([NEXT_DAY])]] },
      { id: 'a', subject: 'Flex report', at: '2026-10-06T06:00:00Z', attachments: [['a.xml', sampleFlexReport([DAY])]] },
    ])
    const { query, mails } = await plan
    expect(query).toBe(`from:(reports@broker.example.com) subject:"Flex" "Activity" has:attachment after:${Date.parse('2026-10-01T00:00:00Z') / 1000}`)
    expect(mailbox.queries).toEqual([query])
    expect(mails.map((mail) => mail.mail.id)).toEqual(['a', 'b'])
    expect(mails.map((mail) => mail.kind)).toEqual(['read', 'read'])
  })

  it('passes over a mail with no file of its format, saying so, and fails a file that does not fit without stopping the others', async () => {
    const { plan } = ports([
      { id: 'pdf', subject: 'Flex statement', at: '2026-10-06T06:00:00Z', attachments: [['statement.pdf', 'pdf bytes']] },
      { id: 'bad', subject: 'Flex changed', at: '2026-10-07T06:00:00Z', attachments: [['bad.xml', sampleFlexReport([DAY], 'no-trades-section')]] },
      { id: 'good', subject: 'Flex fine', at: '2026-10-08T06:00:00Z', attachments: [['good.xml', sampleFlexReport([DAY])]] },
    ])
    const { mails } = await plan
    expect(mails.map((mail) => mail.kind)).toEqual(['no-file', 'misfit', 'read'])
    expect(mails[1]).toMatchObject({ fileName: 'bad.xml', misfit: { kind: 'no-section', section: 'Trades' } })
  })

  it('downloads only files of its format, and a file once per page', async () => {
    const known = new Map()
    const mails = [
      {
        id: 'a',
        subject: 'Flex',
        at: '2026-10-06T06:00:00Z',
        attachments: [
          ['a.xml', sampleFlexReport([DAY])],
          ['a.pdf', 'pdf bytes'],
        ] as [string, string][],
      },
    ]
    const first = ports(mails, known)
    await first.plan
    expect(first.mailbox.downloads).toEqual(['a/0'])
    const second = ports(mails, known)
    await second.plan
    expect(second.mailbox.downloads).toEqual([])
  })
})
