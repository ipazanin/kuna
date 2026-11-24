// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import type { InvestmentPeriod } from '../src/apps/investments/workbook/domain/investmentAccount'
import { NO_CHOICES, settledImport } from '../src/apps/investments/imports/domain/importChoices'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { DryRunEntry, WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { readMailReports } from '../src/apps/investments/mail/application/mailReports'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { newestReportDay, reportNews } from '../src/apps/investments/mail/domain/mailReview'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { flexReportOf, sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import type { Fields, SampleFlexShape } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import { WORKBOOK_TYPES } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalOfText, decimalText } from '../src/shared/money/decimal'
import type { Decimal } from '../src/shared/money/decimal'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { fileNameFits, readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { GBP, USD, account, book, exchange, instrument, rateBookOf, trade } from './fixtures/investments'
import { testMailbox } from './fixtures/mailbox'

const DAY = parseCivilDate('2026-10-05')!
const NEXT_DAY = parseCivilDate('2026-10-06')!
const SINCE = parseCivilDate('2026-01-01')!
const MAILED = { kind: 'mailed', since: SINCE } as const
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', [{ source: 'mail', from: SINCE }])
const ABC = instrument('abc', { name: 'Example Tech', isin: 'XX000000ABC1', currency: USD })
const DEF = instrument('def', { name: 'Example Dividend Co', isin: 'US000000DEF2', currency: USD })
const RATES = rateBookOf(
  new Map([
    [USD, [['2026-10-01', '1.10']]],
    [GBP, [['2026-10-01', '0.87']]],
  ]),
)
const EUR = EURO

function decimal(text: string): Decimal {
  return decimalOfText(text)!
}

function fileOf(days: readonly CivilDate[], shape: SampleFlexShape = 'plain') {
  return fileOfReport(sampleFlexReport(days, shape))
}

function fileOfReport(report: string) {
  const bytes = new TextEncoder().encode(report).buffer as ArrayBuffer
  const read = readRecipeFile(IBKR_FLEX_RECIPE, bytes)
  if (read.kind !== 'read') throw new Error(`It did not read: ${read.misfit.kind}`)
  const run = runRecipe(IBKR_FLEX_RECIPE, read.rows)
  if (run.kind !== 'read') throw new Error(`It does not fit: ${run.misfit.kind}`)
  return { fileName: 'report.xml', run }
}

function rowsOf(days: readonly CivilDate[] = [DAY], shape: SampleFlexShape = 'plain'): WorkbookRows {
  return reportRows(IBKR_FLEX_RECIPE, [fileOf(days, shape)], { leftOut: [] }, MAILED)
}

function rowsOfReport(report: string): WorkbookRows {
  return reportRows(IBKR_FLEX_RECIPE, [fileOfReport(report)], { leftOut: [] }, MAILED)
}

const compactDay = DAY.replaceAll('-', '')

const STOCK_BUY: Fields = { transactionID: '1', assetCategory: 'STK', symbol: 'ABC', isin: 'XX000000ABC1', currency: 'USD', dateTime: `${compactDay};103015`, buySell: 'BUY', taxes: '0', notes: '' }

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
    expect(records.map((imported) => imported.kind).sort()).toEqual(
      ['cash-movement', 'cash-movement', 'cash-movement', 'cash-movement', 'cash-movement', 'exchange', 'income', 'income', 'trade', 'trade'].sort(),
    )
    expect(run.entries.filter((entry) => entry.outcome.kind === 'waiting')).toEqual([])
    expect(run.skipped).toEqual([])
  })

  it("keeps a fractional quantity and IBKR's worth for it, and takes the fee from the net cash", () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const buy = records.find((imported) => imported.kind === 'trade' && imported.record.side === 'buy')
    expect(buy?.record).toMatchObject({ quantity: decimal('1.2345'), price: decimal('100.5'), brokerWorth: decimal('124.06725'), fees: decimal('0.35'), date: DAY })
  })

  it("keeps the report's amounts to the last decimal it gives", () => {
    const commission = { ibCommission: '-5.001193617', ibCommissionCurrency: 'USD' }
    const buy = { ...STOCK_BUY, quantity: '81', tradePrice: '122.6733', proceeds: '-9936.54', netCash: '-9941.541193617', ...commission }
    const deposit = { transactionID: '2', type: 'Deposits/Withdrawals', currency: 'EUR', dateTime: compactDay, amount: '600.000001' }
    const records = recordsOf(workbookDryRun(rowsOfReport(flexReportOf(DAY, { trades: [buy], cash: [deposit] })), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    expect(records.map((imported) => imported.record)).toMatchObject([{ fees: decimal('5.001193617') }, { amount: decimal('600.000001') }])
  })

  it('books a commission in another currency as its own fee, leaving its trade to the cash it moved', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const sale = records.find((imported) => imported.kind === 'trade' && imported.record.side === 'sell')
    expect(sale?.record).toMatchObject({ quantity: decimal('0.5'), fees: decimal('0') })
    const fee = records.find((imported) => imported.kind === 'cash-movement' && imported.record.kind === 'fee' && imported.record.currency === EUR)
    expect(fee?.record).toMatchObject({ amount: decimal('0.25'), note: expect.stringContaining('ABC') })
  })

  it('keeps the day the report says a buy or a sale settles', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    const trades = records.flatMap((imported) => (imported.kind === 'trade' ? [[imported.record.side, imported.record.settles]] : []))
    expect(trades.sort()).toEqual([
      ['buy', NEXT_DAY],
      ['sell', NEXT_DAY],
    ])
  })

  it('books a CASH row with no ISIN as an exchange from its quantity and proceeds, though its net cash is zero', () => {
    const records = recordsOf(workbookDryRun(rowsOf(), { book: kept(), rates: RATES, answers: ANSWERS }).entries)
    expect(records.find((imported) => imported.kind === 'exchange')?.record).toMatchObject({
      sold: decimal('550'),
      soldCurrency: USD,
      bought: decimal('500'),
      boughtCurrency: EUR,
      fees: null,
    })
  })

  it('keeps only the detail rows of cash transactions, so a summary row does not count a dividend twice', () => {
    const dividend = { actionID: '5', assetCategory: 'STK', symbol: 'DEF', isin: 'US000000DEF2', currency: 'USD', dateTime: compactDay, settleDate: compactDay, type: 'Dividends', amount: '30' }
    const rows = rowsOfReport(
      flexReportOf(DAY, {
        cash: [
          { ...dividend, transactionID: '1' },
          { ...dividend, transactionID: '2', levelOfDetail: 'SUMMARY' },
        ],
      }),
    )
    expect(rows.rows.map((row) => [row.type, row.gross])).toEqual([['DIVIDEND', decimal('30')]])
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
        ['fee-refund', decimal('0.5'), USD],
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
    expect(recordsOf(run.entries)).toHaveLength(10)
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

const CONVERSION: Fields = {
  transactionID: '1',
  assetCategory: 'CASH',
  symbol: 'EUR.USD',
  description: 'EUR.USD',
  currency: 'USD',
  dateTime: `${compactDay};062143`,
  taxes: '0',
  netCash: '0',
  notes: '',
}

/** What a record of the conversion says, for reading a case at a glance. */
function conversionOutcome(conversion: Fields): readonly string[] {
  const rows = rowsOfReport(flexReportOf(DAY, { trades: [{ ...CONVERSION, ...conversion }] }))
  const run = workbookDryRun(rows, { book: kept(), rates: RATES, answers: ANSWERS })
  return [
    ...recordsOf(run.entries).map((imported) => {
      if (imported.kind === 'exchange') {
        const { sold, soldCurrency, bought, boughtCurrency, fees } = imported.record
        return `sold ${decimalText(sold)} ${soldCurrency}, bought ${decimalText(bought)} ${boughtCurrency}, fees ${fees === null ? 'none' : `${decimalText(fees.amount)} ${fees.currency}`}`
      }
      return imported.kind === 'cash-movement'
        ? `${imported.record.kind} ${decimalText(imported.record.amount)} ${imported.record.currency} of ${imported.record.note.includes('EUR.USD') ? 'EUR.USD' : '?'}`
        : imported.kind
    }),
    ...run.skipped.map((skip) => `skipped: ${skip.reason.kind}`),
    ...(rows.report?.asked ?? []).map((asked) => `asked: ${asked.why.kind}`),
  ]
}

describe('a conversion in the report', () => {
  it.each<[string, Fields, readonly string[]]>([
    [
      'an AutoFX buy of euros, as IBKR sends it',
      { buySell: 'BUY', quantity: '104.3', tradePrice: '1.09693', proceeds: '-114.409799', ibCommission: '0', ibCommissionCurrency: 'EUR', notes: 'AFx' },
      ['sold 114.409799 USD, bought 104.3 EUR, fees none'],
    ],
    ['a sale of euros', { buySell: 'SELL', quantity: '-100', tradePrice: '1.1', proceeds: '110', ibCommission: '0', ibCommissionCurrency: 'EUR' }, ['sold 100 EUR, bought 110 USD, fees none']],
    [
      'a buy with its commission in euros, off the euros bought',
      { buySell: 'BUY', quantity: '6530.48', tradePrice: '1.08095', proceeds: '-7059.122356', ibCommission: '-1.84926', ibCommissionCurrency: 'EUR' },
      ['sold 7059.122356 USD, bought 6528.63074 EUR, fees 1.84926 EUR'],
    ],
    [
      'a buy with its commission in dollars, on top of the dollars sold',
      { buySell: 'BUY', quantity: '500', tradePrice: '1.1', proceeds: '-550', ibCommission: '-2', ibCommissionCurrency: 'USD' },
      ['sold 552 USD, bought 500 EUR, fees 2 USD'],
    ],
    [
      'a sale with its commission in euros, on top of the euros sold',
      { buySell: 'SELL', quantity: '-500', tradePrice: '1.1', proceeds: '550', ibCommission: '-2', ibCommissionCurrency: 'EUR' },
      ['sold 502 EUR, bought 550 USD, fees 2 EUR'],
    ],
    [
      'a sale with its commission in dollars, off the dollars bought',
      { buySell: 'SELL', quantity: '-500', tradePrice: '1.1', proceeds: '550', ibCommission: '-2', ibCommissionCurrency: 'USD' },
      ['sold 500 EUR, bought 548 USD, fees 2 USD'],
    ],
    [
      'a commission in a third currency, as a fee of its own',
      { buySell: 'BUY', quantity: '500', tradePrice: '1.1', proceeds: '-550', ibCommission: '-1.5', ibCommissionCurrency: 'GBP' },
      ['sold 550 USD, bought 500 EUR, fees none', 'fee 1.5 GBP of EUR.USD'],
    ],
    [
      'dust IBKR converts after a trade, to its last decimal',
      { buySell: 'BUY', quantity: '0.000932', tradePrice: '1.09712904', proceeds: '-0.001022524', ibCommission: '0', ibCommissionCurrency: 'EUR' },
      ['sold 0.001022524 USD, bought 0.000932 EUR, fees none'],
    ],
    ['a conversion of nothing', { buySell: 'BUY', quantity: '0', tradePrice: '1.1', proceeds: '0', ibCommission: '0', ibCommissionCurrency: 'EUR' }, ['skipped: below-a-cent']],
    [
      'AutoFX on a partial fill',
      { buySell: 'BUY', quantity: '10', tradePrice: '1.1', proceeds: '-11', ibCommission: '0', ibCommissionCurrency: 'EUR', notes: 'AFx;P' },
      ['sold 11 USD, bought 10 EUR, fees none'],
    ],
    ['a cancelled conversion', { buySell: 'BUY', quantity: '10', tradePrice: '1.1', proceeds: '-11', ibCommission: '0', ibCommissionCurrency: 'EUR', notes: 'Ca' }, ['asked: no-kind']],
  ])('%s', (_case, conversion, outcome) => {
    expect(conversionOutcome(conversion)).toEqual(outcome)
  })
})

describe("a report's fractions against a record kept to the cent", () => {
  const AUTO_FX = { ...CONVERSION, buySell: 'BUY', quantity: '104.3', tradePrice: '1.09693', proceeds: '-114.409799', ibCommission: '0', ibCommissionCurrency: 'EUR', notes: 'AFx' }
  const rows = () => rowsOfReport(flexReportOf(DAY, { trades: [AUTO_FX] }))

  function withSold(planned: ReturnType<typeof kept>, sold: string) {
    return { ...planned, exchanges: planned.exchanges.map((kept) => ({ ...kept, sold: decimal(sold) })) }
  }

  it.each([
    ['114.41', 'in-kuna'],
    ['114.409799', 'in-kuna'],
    ['114.42', 'waiting'],
    ['114.4098', 'waiting'],
  ])('takes a record that sold %s USD as %s', (sold, outcome) => {
    const planned = workbookDryRun(rows(), { book: kept(), rates: RATES, answers: ANSWERS }).planned
    const again = workbookDryRun(rows(), { book: withSold(planned, sold), rates: RATES, answers: ANSWERS })
    expect(again.entries.map((entry) => entry.outcome.kind)).toEqual([outcome])
  })

  it('asks whether a conversion typed by hand to the cent is the same one', () => {
    const typed = { ...kept(), exchanges: [exchange(ACCOUNT, DAY, '114.41', USD, '104.30', EUR)] }
    const run = workbookDryRun(rows(), { book: typed, rates: RATES, answers: ANSWERS })
    expect(run.entries.map((entry) => entry.outcome)).toMatchObject([{ kind: 'waiting', reason: { kind: 'looks-in-kuna' } }])
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
    const later = account('kuna-ibkr', 'Kuna IBKR', [{ source: 'mail', from: NEXT_DAY }])
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

  it('asks nothing for a report account known as an account kept by hand, and counts its mailed rows under by hand', () => {
    const byHand = account('kuna-ibkr-by-hand', 'Kuna IBKR by hand')
    const uploaded = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY])], { leftOut: [] }, { kind: 'uploaded' })
    const before = book({ accounts: [ACCOUNT, byHand], instruments: [ABC, DEF], trades: [trade('buy', byHand, ABC, '2026-01-05', '10', '90', '1', '1.1')] })
    const kept = workbookDryRun(uploaded, { book: before, rates: RATES, answers: { ...ANSWERS, accounts: new Map([['U0000001', byHand]]) } }).planned
    const rows = rowsOf([DAY, NEXT_DAY])
    const dryRun = workbookDryRun(rows, { book: kept, rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.questions.accounts).toEqual([])
    expect(dryRun.entries).toEqual([])
    expect(dryRun.report?.byHand).toBe(rows.rows.length)
    const settled = settledImport(rows, kept, RATES, NO_CHOICES, (key) => `new-${key}`)
    expect(settled.accounts).toEqual([])
    expect(settled.dryRun.entries).toEqual([])
  })

  it('refuses an uploaded report on days the mail fills, and takes its rows of the days the account gives to uploads', () => {
    const rows = reportRows(IBKR_FLEX_RECIPE, [fileOf([DAY, NEXT_DAY])], { leftOut: [] }, { kind: 'uploaded' })
    const dryRunOn = (sources: readonly InvestmentPeriod[]) => {
      const later = account('kuna-ibkr', 'Kuna IBKR', sources)
      return workbookDryRun(rows, { book: book({ accounts: [later], instruments: [ABC, DEF] }), rates: RATES, answers: { ...ANSWERS, accounts: new Map([['U0000001', later]]) } })
    }
    const mailOnly: readonly InvestmentPeriod[] = [{ source: 'mail', from: NEXT_DAY }]
    expect(dryRunOn(mailOnly).entries).toEqual([])
    expect(dryRunOn(mailOnly).skipped.map((row) => row.reason)).toContainEqual({ kind: 'mail-owns', account: 'Kuna IBKR' })
    const allowed = dryRunOn([{ source: 'provider-file', from: null }, ...mailOnly])
    expect(allowed.entries.some((entry) => entry.rows[0].date === DAY)).toBe(true)
    expect(allowed.report).toMatchObject({ mailed: false, beforeStart: 0, byHand: 0 })
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
    expect(reportNews(rows, kept(), RATES)).toEqual({ fresh: 10, changed: 0, asked: 6 })
    const planned = workbookDryRun(rows, { book: kept(), rates: RATES, answers: ANSWERS }).planned
    expect(reportNews(rows, planned, RATES)).toEqual({ fresh: 0, changed: 0, asked: 6 })
    expect(newestReportDay(planned)).toBe(DAY)
    expect(newestReportDay(kept())).toBeNull()
  })
})

describe("a mailed report's rows before a start day", () => {
  const LATER = account('kuna-ibkr-later', 'Kuna IBKR later', [{ source: 'mail', from: NEXT_DAY }])
  const KEYED_IDS = (key: string) => `new-${key}`

  function waiting(entries: readonly DryRunEntry[]) {
    return entries.filter((entry) => entry.outcome.kind === 'waiting')
  }

  it('leaves out the rows of an unlinked account dated before the earliest start day, asking nothing', () => {
    const rows = rowsOf([DAY])
    const dryRun = workbookDryRun(rows, { book: book({ accounts: [LATER], instruments: [ABC, DEF] }), rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.questions.accounts).toEqual([])
    expect(dryRun.entries).toEqual([])
    expect(dryRun.report?.beforeStart).toBe(rows.rows.length)
  })

  it('still asks for the account of an unlinked row on the earliest start day', () => {
    const rows = rowsOf([DAY, NEXT_DAY])
    const dryRun = workbookDryRun(rows, { book: book({ accounts: [LATER], instruments: [ABC, DEF] }), rates: RATES, answers: NO_ANSWERS })
    expect(dryRun.questions.accounts).toMatchObject([{ account: 'U0000001', firstDay: NEXT_DAY, rows: rows.rows.filter((row) => row.date === NEXT_DAY).length }])
    expect(dryRun.entries.every((entry) => entry.rows[0].date === NEXT_DAY && entry.outcome.kind === 'waiting')).toBe(true)
    expect(dryRun.report?.beforeStart).toBe(rows.rows.filter((row) => row.date === DAY).length)
  })

  it('never reads a choice for an account it does not ask about, when every row falls before the earliest start day', () => {
    const rows = rowsOf([DAY])
    const settled = settledImport(rows, book({ accounts: [LATER], instruments: [ABC, DEF] }), RATES, { ...NO_CHOICES, accounts: { U0000001: { kind: 'existing', account: LATER.id } } }, KEYED_IDS)
    expect(waiting(settled.dryRun.entries)).toEqual([])
    expect(settled.dryRun.report?.beforeStart).toBe(rows.rows.length)
  })

  it('asks once for an account whose rows fall between two start days, and counts them as before the start day of the account picked', () => {
    const rows = rowsOf([DAY])
    const kept = book({ accounts: [ACCOUNT, LATER], instruments: [ABC, DEF] })
    const picked = { ...NO_CHOICES, accounts: { U0000001: { kind: 'existing', account: LATER.id } } } as const
    const settled = settledImport(rows, kept, RATES, picked, KEYED_IDS)
    expect(settled.accounts).toMatchObject([{ question: { account: 'U0000001' }, choice: { kind: 'existing', account: LATER.id } }])
    expect(waiting(settled.dryRun.entries)).toEqual([])
    expect(settled.dryRun.entries).toEqual([])
    expect(settled.dryRun.report?.beforeStart).toBe(rows.rows.length)
  })

  it('reaches a fixed point between two start days: the answer keeps its own question, so the next pass gives the same dry run', () => {
    const rows = rowsOf([DAY])
    const kept = book({ accounts: [ACCOUNT, LATER], instruments: [ABC, DEF] })
    const settled = settledImport(rows, kept, RATES, { ...NO_CHOICES, accounts: { U0000001: { kind: 'existing', account: LATER.id } } }, KEYED_IDS)
    const unanswered = workbookDryRun(rows, { book: kept, rates: RATES, answers: NO_ANSWERS })
    const answered = workbookDryRun(rows, { book: kept, rates: RATES, answers: { ...NO_ANSWERS, accounts: new Map([['U0000001', LATER]]) } })
    expect(answered.questions.accounts).toEqual(unanswered.questions.accounts)
    expect(settled.dryRun).toEqual(answered)
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
