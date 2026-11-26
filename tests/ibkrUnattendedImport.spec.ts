// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { NO_CHOICES, instrumentAsked, reviewQuestions, settledImport } from '../src/apps/investments/imports/domain/importChoices'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { OPTIONAL_COLUMNS, WORKBOOK_COLUMNS } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { IBKR_FLEX_RECIPE } from '../src/apps/investments/mail/domain/ibkrFlexRecipe'
import { reportRows } from '../src/apps/investments/mail/domain/reportRows'
import { unattendedWaits } from '../src/apps/investments/mail/domain/unattendedImport'
import type { UnattendedFacts } from '../src/apps/investments/mail/domain/unattendedImport'
import { flexReportOf, sampleFlexReport } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import type { Fields } from '../src/apps/investments/mail/infrastructure/fake/sampleFlexReport'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { parseCivilDate, serialFromCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { EURO } from '../src/shared/money/currencyCode'
import { runRecipe } from '../src/shared/recipes/domain/runRecipe'
import { readRecipeFile } from '../src/shared/recipes/infrastructure/recipeFile'
import { USD, account, book, exchange, instrument, rateBookOf, trade } from './fixtures/investments'
import { civil } from './fixtures/ledger'

const DAY = parseCivilDate('2026-10-05')!
const NEXT_DAY = parseCivilDate('2026-10-06')!
const MAILED = { kind: 'mailed', since: parseCivilDate('2026-01-01')! } as const
const ACCOUNT = account('kuna-ibkr', 'Kuna IBKR', [{ source: 'mail', from: parseCivilDate('2026-01-01')! }])
const ABC = instrument('abc', { name: 'Example Tech', isin: 'XX000000ABC1', currency: USD })
const DEF = instrument('def', { name: 'Example Dividend Co', isin: 'US000000DEF2', currency: USD })
const GHI_ISIN = 'XX000000GHI3'
const RATES = rateBookOf(new Map([[USD, [['2026-10-01', '1.10']]]]))
const NOTHING_ELSE: UnattendedFacts = { misfit: false, lackingRates: [], undone: new Set() }

const ANSWERS: WorkbookAnswers = {
  ...NO_ANSWERS,
  accounts: new Map([['U0000001', ACCOUNT]]),
  instruments: new Map([
    ['XX000000ABC1', ABC],
    ['US000000DEF2', DEF],
  ]),
}

function compact(day: CivilDate): string {
  return day.replaceAll('-', '')
}

function rowsOfReport(report: string): WorkbookRows {
  const read = readRecipeFile(IBKR_FLEX_RECIPE, new TextEncoder().encode(report).buffer as ArrayBuffer)
  if (read.kind !== 'read') throw new Error('It did not read.')
  const run = runRecipe(IBKR_FLEX_RECIPE, read)
  if (run.kind !== 'read') throw new Error('It does not fit.')
  return reportRows(IBKR_FLEX_RECIPE, [{ fileName: 'report.xml', run }], { leftOut: [] }, MAILED)
}

/** The book once the report of the first day was accepted, so its account and holdings are known from an earlier import. */
function known(extra: Partial<InvestmentBook> = {}): InvestmentBook {
  const before = book({ accounts: [ACCOUNT], instruments: [ABC, DEF], trades: [trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1')] })
  const planned = workbookDryRun(rowsOfReport(sampleFlexReport([DAY])), { book: before, rates: RATES, answers: ANSWERS }).planned
  return { ...planned, ...extra, instruments: [...planned.instruments, ...(extra.instruments ?? [])] }
}

/** A buy on the next day of the holding the fields name, with its commission in its own currency. */
function buyOf(fields: Fields = {}): Fields {
  return {
    transactionID: '7001',
    assetCategory: 'STK',
    symbol: 'ABC',
    isin: 'XX000000ABC1',
    currency: 'USD',
    dateTime: `${compact(NEXT_DAY)};103015`,
    buySell: 'BUY',
    quantity: '1',
    tradePrice: '100',
    proceeds: '-100',
    ibCommission: '-1',
    ibCommissionCurrency: 'USD',
    taxes: '0',
    netCash: '-101',
    notes: '',
    ...fields,
  }
}

function nextDay(rows: { readonly trades?: readonly Fields[]; readonly cash?: readonly Fields[] }): WorkbookRows {
  return rowsOfReport(flexReportOf(NEXT_DAY, rows))
}

function waitsOf(rows: WorkbookRows, held: InvestmentBook, facts: Partial<UnattendedFacts> = {}): string[] {
  const settled = settledImport(rows, held, RATES, NO_CHOICES, (key) => `new-${key}`)
  return unattendedWaits(settled, held, { ...NOTHING_ELSE, ...facts }).map((wait) => wait.kind)
}

type Column = keyof typeof WORKBOOK_COLUMNS | keyof typeof OPTIONAL_COLUMNS
const COLUMNS = Object.keys({ ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }) as Column[]
const TITLES: Record<Column, string> = { ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }
const WORKBOOK_ABC = { broker: 'Made-up Broker', account: 'MADE-UP-1', yahooSymbol: 'ABC', brokerSymbol: 'ABC', isin: 'XX000000ABC1' } as const

/** Rows of the portfolio workbook, which can hold a split or a spin-off, as a report's recipe asks about instead. */
function workbookRows(...lines: Partial<Record<Column, string | number>>[]): WorkbookRows {
  const grid = lines.map((cells) => COLUMNS.map((column) => (column === 'date' ? serialFromCivilDate(civil(String(cells.date))) : (cells[column] ?? ''))))
  const reading = readPortfolioWorkbook([{ name: 'Transactions', grid: [COLUMNS.map((column) => TITLES[column]), ...grid] }])
  if (reading.kind !== 'read') throw new Error('The rows were refused.')
  return reading
}

describe('a report a sync imports by itself', () => {
  it('waits for nothing when its account and holdings are known from an earlier import', () => {
    expect(waitsOf(nextDay({ trades: [buyOf()] }), known())).toEqual([])
  })

  it('takes a holding no import wrote to yet when it is the only one with the rows’ ISIN', () => {
    const ghi = instrument('ghi', { name: 'Example Growth', isin: GHI_ISIN, symbol: 'GHI', currency: USD })
    const rows = nextDay({ trades: [buyOf({ symbol: 'GHI', isin: GHI_ISIN })] })
    const held = known({ instruments: [ghi] })
    expect(waitsOf(rows, held)).toEqual([])
    const settled = settledImport(rows, held, RATES, NO_CHOICES, (key) => `new-${key}`)
    expect(settled.dryRun.added.trades.map((added) => added.instrument)).toEqual([ghi.id])
  })

  it('waits for a file that does not fit', () => {
    expect(waitsOf(nextDay({ trades: [buyOf()] }), known(), { misfit: true })).toEqual(['misfit'])
  })

  it('waits for ECB rates still missing after a fetch', () => {
    expect(waitsOf(nextDay({ trades: [buyOf()] }), known(), { lackingRates: ['USD'] })).toEqual(['rates'])
  })

  it('waits for an account no earlier import wrote to', () => {
    const fresh = book({ accounts: [ACCOUNT], instruments: [ABC, DEF] })
    expect(waitsOf(nextDay({ trades: [buyOf()] }), fresh)).toContain('account')
  })

  it('waits for a holding Kuna does not have', () => {
    expect(waitsOf(nextDay({ trades: [buyOf({ symbol: 'GHI', isin: GHI_ISIN })] }), known())).toEqual(['instrument'])
  })

  it('waits for a holding that matches by its symbol alone', () => {
    const bySymbol = instrument('ghi', { name: 'Example Growth', isin: null, symbol: 'GHI', currency: USD })
    expect(waitsOf(nextDay({ trades: [buyOf({ symbol: 'GHI', isin: GHI_ISIN })] }), known({ instruments: [bySymbol] }))).toEqual(['instrument'])
  })

  it('waits for a trade in another currency than the one holding with its ISIN quotes in', () => {
    const inEuros = instrument('ghi', { isin: GHI_ISIN, symbol: 'GHI', currency: EURO })
    expect(waitsOf(nextDay({ trades: [buyOf({ symbol: 'GHI', isin: GHI_ISIN })] }), known({ instruments: [inEuros] }))).toEqual(['waiting'])
  })

  it('waits for a split', () => {
    const rows = workbookRows(
      { ...WORKBOOK_ABC, date: '2026-01-06', type: 'BUY', quantity: 10, price: 100, currency: 'USD', gross: -1000, commission: 1, netCash: -1001 },
      { ...WORKBOOK_ABC, date: '2026-06-10', type: 'SPLIT', quantity: 30 },
    )
    expect(waitsOf(rows, book({ instruments: [ABC] }))).toContain('split')
  })

  it('waits for a spin-off, even one its row answers whole', () => {
    const rows = workbookRows(
      { ...WORKBOOK_ABC, date: '2026-01-06', type: 'BUY', quantity: 10, price: 100, currency: 'USD', gross: -1000, commission: 1, netCash: -1001 },
      {
        broker: 'Made-up Broker',
        account: 'MADE-UP-1',
        yahooSymbol: 'NEWCO',
        brokerSymbol: 'NEWCO',
        date: '2026-07-01',
        type: 'SPINOFF',
        quantity: 4,
        price: 12,
        currency: 'USD',
        spinOffFrom: 'ABC',
        costShare: 0.1,
      },
    )
    expect(waitsOf(rows, book({ instruments: [ABC] }))).toContain('spin-off')
  })

  it('waits for a row that looks like a record typed by hand', () => {
    const conversion = {
      transactionID: '7002',
      assetCategory: 'CASH',
      symbol: 'EUR.USD',
      currency: 'USD',
      dateTime: `${compact(NEXT_DAY)};062143`,
      buySell: 'BUY',
      quantity: '104.3',
      tradePrice: '1.09693',
      proceeds: '-114.409799',
      ibCommission: '0',
      ibCommissionCurrency: 'EUR',
      taxes: '0',
      netCash: '0',
      notes: 'AFx',
    }
    const typed = known({ exchanges: [...known().exchanges, exchange(ACCOUNT, NEXT_DAY, '114.41', USD, '104.30', EURO)] })
    expect(waitsOf(nextDay({ trades: [conversion] }), typed)).toEqual(['look-alike'])
  })

  it('waits for a row its recipe asks about', () => {
    expect(waitsOf(rowsOfReport(sampleFlexReport([NEXT_DAY], 'unseen')), known())).toContain('asked')
  })

  it('waits for a sale of more than the account holds', () => {
    expect(waitsOf(nextDay({ trades: [buyOf({ buySell: 'SELL', quantity: '-500', proceeds: '50000', netCash: '49999' })] }), known())).toEqual(['waiting'])
  })

  it('waits for tax withheld whose dividend is in no file', () => {
    const tax = {
      transactionID: '7003',
      actionID: '99',
      type: 'Withholding Tax',
      assetCategory: 'STK',
      symbol: 'DEF',
      isin: 'US000000DEF2',
      currency: 'USD',
      dateTime: compact(NEXT_DAY),
      amount: '-4.5',
    }
    expect(waitsOf(nextDay({ cash: [tax] }), known())).toEqual(['waiting'])
  })

  it('waits for a row it cannot keep', () => {
    expect(waitsOf(nextDay({ trades: [buyOf({ netCash: '101' })] }), known())).toContain('skipped')
  })

  it('takes a conversion of less than a cent as dust, which it leaves out', () => {
    const nothing = {
      transactionID: '7004',
      assetCategory: 'CASH',
      symbol: 'EUR.USD',
      currency: 'USD',
      dateTime: `${compact(NEXT_DAY)};062143`,
      buySell: 'BUY',
      quantity: '0',
      tradePrice: '1.1',
      proceeds: '0',
      ibCommission: '0',
      ibCommissionCurrency: 'EUR',
      taxes: '0',
      netCash: '0',
      notes: 'AFx',
    }
    expect(waitsOf(nextDay({ trades: [buyOf(), nothing] }), known())).toEqual([])
  })

  it('waits for a row signed against its type, which it would book as what it reverses', () => {
    const rows = workbookRows({ broker: 'Made-up Broker', account: 'MADE-UP-1', date: '2026-10-06', type: 'INTEREST', currency: 'EUR', netCash: -1.2 })
    const settled = settledImport(rows, book({}), RATES, NO_CHOICES, (key) => `new-${key}`)
    expect(settled.dryRun.reversals).toHaveLength(1)
    expect(waitsOf(rows, book({}))).toContain('worth-a-look')
  })

  it('waits for a trade whose fees differ from its commission', () => {
    expect(waitsOf(nextDay({ trades: [buyOf({ netCash: '-105' })] }), known())).toEqual(['worth-a-look'])
  })

  it('waits for rows a sync imported and Undo took back', () => {
    const rows = nextDay({ trades: [buyOf()] })
    const keys = new Set(settledImport(rows, known(), RATES, NO_CHOICES, (key) => `new-${key}`).dryRun.added.trades.flatMap((added) => added.importKeys))
    expect(waitsOf(rows, known(), { undone: keys })).toEqual(['undone'])
  })

  it('imports the rest while a record it booked earlier has other figures now, which stays in the banner', () => {
    const whole = rowsOfReport(sampleFlexReport([DAY]))
    const noTax = { ...whole, rows: whole.rows.filter((row) => !(row.type === 'WITHHOLDING TAX' && row.isin !== '')) }
    const before = book({ accounts: [ACCOUNT], instruments: [ABC, DEF], trades: [trade('buy', ACCOUNT, ABC, '2026-01-05', '10', '90', '1', '1.1')] })
    const accepted = workbookDryRun(noTax, { book: before, rates: RATES, answers: ANSWERS }).planned
    const later = rowsOfReport(sampleFlexReport([DAY, NEXT_DAY]))
    const settled = settledImport(later, accepted, RATES, NO_CHOICES, (key) => `new-${key}`)
    expect(unattendedWaits(settled, accepted, NOTHING_ELSE)).toEqual([])
    expect(settled.dryRun.entries.filter((entry) => entry.outcome.kind === 'waiting').map((entry) => entry.outcome)).toEqual([{ kind: 'waiting', reason: { kind: 'differs-from-kuna' } }])
    expect(settled.dryRun.added.trades.length).toBeGreaterThan(0)
  })
})

describe('the questions a review asks', () => {
  const rows = nextDay({ trades: [buyOf({ symbol: 'GHI', isin: GHI_ISIN })] })
  const askedOf = (held: InvestmentBook) =>
    reviewQuestions(
      settledImport(rows, held, RATES, NO_CHOICES, (key) => `new-${key}`),
      held,
    ).instruments.map(({ question }) => instrumentAsked(question, held))

  it('asks nothing of a holding that alone has the rows’ ISIN', () => {
    expect(askedOf(known({ instruments: [instrument('ghi', { isin: GHI_ISIN, symbol: 'GHI', currency: USD })] }))).toEqual([])
  })

  it('asks about a holding that matches by its symbol alone', () => {
    expect(askedOf(known({ instruments: [instrument('ghi', { isin: null, symbol: 'GHI', currency: USD })] }))).toEqual(['symbol-only'])
  })

  it('asks about a holding Kuna does not have', () => {
    expect(askedOf(known())).toEqual(['none-fits'])
  })

  it('asks nothing of a holding an earlier import wrote to', () => {
    expect(
      reviewQuestions(
        settledImport(nextDay({ trades: [buyOf()] }), known(), RATES, NO_CHOICES, (key) => `new-${key}`),
        known(),
      ).instruments,
    ).toEqual([])
  })
})
