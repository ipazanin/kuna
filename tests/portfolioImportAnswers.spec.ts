import { describe, expect, it } from 'vitest'

import { readPortfolioWorkbookFile } from '../src/apps/investments/imports/application/portfolioWorkbookFile'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import type { DryRunEntry, WorkbookAnswers, WorkbookRows } from '../src/apps/investments/imports/domain/importDryRun'
import { OPTIONAL_COLUMNS, WORKBOOK_COLUMNS, readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { ratesWanted } from '../src/apps/investments/imports/domain/workbookRates'
import { portfolioTemplateFile } from '../src/apps/investments/imports/infrastructure/portfolioTemplate'
import { dryRunGroups } from '../src/apps/investments/imports/presentation/dryRunLines'
import { NO_CHOICES, settledImport } from '../src/apps/investments/imports/presentation/importChoices'
import type { SplitsAnswer } from '../src/apps/investments/imports/presentation/importChoices'
import { words } from '../src/apps/investments/imports/presentation/words'
import { tradeTotal } from '../src/apps/investments/holdings/domain/lots'
import type { Trade } from '../src/apps/investments/workbook/domain/trade'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import { decimalText, roundedDecimal } from '../src/shared/money/decimal'
import { USD, account, book, decimal, instrument, rateBookOf } from './fixtures/investments'
import { civil } from './fixtures/ledger'

type Column = keyof typeof WORKBOOK_COLUMNS | keyof typeof OPTIONAL_COLUMNS
type Cells = Partial<Record<Column, string | number>>

const COLUMNS = Object.keys({ ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }) as Column[]
const TITLES: Record<Column, string> = { ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }

const MAIN = { broker: 'Made-up Broker', account: 'MADE-UP-1' } as const
const ABC = { yahooSymbol: 'ABC', brokerSymbol: 'ABC', isin: 'US0000000001' } as const
const NEWCO = { yahooSymbol: 'NEWCO', brokerSymbol: 'NEWCO' } as const

function line(date: string, cells: Cells): (string | number)[] {
  return COLUMNS.map((column) => (column === 'date' ? serialFromCivilDate(civil(date)) : (cells[column] ?? '')))
}

/** The rows read from a Transactions tab with every column, the optional ones too. */
function rowsOf(...lines: (string | number)[][]): WorkbookRows {
  const reading = readPortfolioWorkbook([{ name: 'Transactions', grid: [COLUMNS.map((column) => TITLES[column]), ...lines] }])
  if (reading.kind !== 'read') throw new Error(`The rows were refused: ${reading.refusal.kind}.`)
  return reading
}

const RATES = rateBookOf(new Map([[USD, [['2024-12-31', '1.05']]]]))
const BROKER = account('broker', 'Broker')
const ABC_SHARE = instrument('abc', { name: 'ABC Corp', isin: 'US0000000001', symbol: 'ABC', currency: USD, prices: 'twelvedata', sourceSymbol: 'ABC' })
const NEWCO_SHARE = instrument('newco', { name: 'NewCo', symbol: 'NEWCO', currency: USD })

const answers = (overrides: Partial<WorkbookAnswers> = {}): WorkbookAnswers => ({
  ...NO_ANSWERS,
  accounts: new Map([['MADE-UP-1', BROKER]]),
  instruments: new Map([
    ['US0000000001', ABC_SHARE],
    ['NEWCO', NEWCO_SHARE],
  ]),
  ...overrides,
})

function entryAt(entries: readonly DryRunEntry[], fileRow: number): DryRunEntry {
  const entry = entries.find((candidate) => candidate.rows[0].fileRow === fileRow)
  if (entry === undefined) throw new Error(`No entry starts at row ${fileRow}.`)
  return entry
}

function tradeAt(entries: readonly DryRunEntry[], fileRow: number): Trade {
  const outcome = entryAt(entries, fileRow).outcome
  if (outcome.kind !== 'new' || outcome.imported.kind !== 'trade') throw new Error(`Row ${fileRow} is no new trade.`)
  return outcome.imported.record
}

const keyed = (keys: ReadonlyMap<string, string>) => (key: string) => keys.get(key) ?? `new-${key}`

describe('a trade whose price the broker rounded to the cent', () => {
  const rows = rowsOf(
    line('2025-01-02', { ...MAIN, type: 'DEPOSIT', currency: 'USD', netCash: 5000, revolutRate: 1.04 }),
    // 40 × 21.17 = 846.80, three cents above what the statement took.
    line('2025-01-06', { ...MAIN, ...ABC, type: 'BUY', quantity: 40, price: 21.17, currency: 'USD', gross: -846.8, netCash: -846.77 }),
    // 30 × 9.87 = 296.10, three cents below what the statement paid.
    line('2025-02-03', { ...MAIN, ...ABC, type: 'SELL', quantity: -30, price: 9.87, currency: 'USD', gross: 296.1, commission: 0, netCash: 296.13 }),
    // A dollar off is no rounding of a price to the cent on ten units.
    line('2025-02-04', { ...MAIN, ...ABC, type: 'BUY', quantity: 10, price: 50, currency: 'USD', gross: -500, netCash: -499 }),
  )
  const dryRun = workbookDryRun(rows, { book: book({}), rates: RATES, answers: answers() })

  it('takes a buy at its net cash, with no fees, so its cost lands on the cent the statement took', () => {
    const buy = tradeAt(dryRun.entries, 3)
    expect([decimalText(buy.price), buy.fees]).toEqual(['21.16925', decimal('0')])
    expect(decimalText(roundedDecimal(tradeTotal(buy, ABC_SHARE.quoted), 2))).toBe('846.77')
  })

  it('takes a sale at its net cash in the same way', () => {
    const sale = tradeAt(dryRun.entries, 4)
    expect([decimalText(sale.price), sale.fees]).toEqual(['9.871', decimal('0')])
    expect(decimalText(roundedDecimal(tradeTotal(sale, ABC_SHARE.quoted), 2))).toBe('296.13')
  })

  it('keeps the rules for a gap bigger than the rounding, which leaves fees below zero to skip', () => {
    expect(dryRun.skipped.map((skip) => skip.fileRow)).toEqual([5])
    expect(dryRunGroups(dryRun, book({}), RATES, () => 'Broker').skipped[0]?.note).toContain('fees')
  })
})

describe('an exchange of less than a cent', () => {
  it('is skipped with a plain reason, not the reader of exchanges', () => {
    const rows = rowsOf(line('2025-03-03', { ...MAIN, type: 'FX', currency: 'USD', netCash: -0.0037, counterCurrency: 'EUR', counterAmount: 0.0034 }))
    const dryRun = workbookDryRun(rows, { book: book({}), rates: RATES, answers: answers() })
    expect(dryRun.skipped).toEqual([{ fileRow: 2, reason: { kind: 'below-a-cent' } }])
    expect(dryRunGroups(dryRun, book({}), RATES, () => 'Broker').skipped[0]?.note).toBe(words.skips.belowACent)
  })
})

describe('the ECB rates the rows need', () => {
  it('names each foreign currency with a row before its first rate, from the earliest such row', () => {
    const rows = rowsOf(
      line('2024-11-04', { ...MAIN, type: 'DEPOSIT', currency: 'USD', netCash: 100, revolutRate: 1.08 }),
      line('2024-12-02', { ...MAIN, type: 'INTEREST', currency: 'USD', gross: 1, netCash: 1 }),
      line('2024-12-03', { ...MAIN, type: 'FEE', currency: 'GBP', netCash: -1 }),
      line('2025-01-06', { ...MAIN, ...ABC, type: 'BUY', quantity: 1, price: 10, currency: 'USD', netCash: -10 }),
      line('2024-10-01', { ...MAIN, type: 'FX', currency: 'EUR', netCash: -10, counterCurrency: 'USD', counterAmount: 11 }),
    )
    expect(ratesWanted(rows.rows, RATES)).toEqual({ currencies: ['USD', 'GBP'], from: '2024-12-02' })
    expect(ratesWanted(rows.rows, rateBookOf(new Map([[USD, [['2024-01-02', '1.1']]]])))).toEqual({ currencies: ['GBP'], from: '2024-12-03' })
  })
})

describe('a spin-off whose row names its parent and its share of the cost', () => {
  function spinOffWith(cells: Cells) {
    const rows = rowsOf(
      line('2025-01-02', { ...MAIN, type: 'DEPOSIT', currency: 'USD', netCash: 5000, revolutRate: 1.04 }),
      line('2025-01-06', { ...MAIN, ...ABC, type: 'BUY', quantity: 10, price: 100, currency: 'USD', gross: -1000, commission: 1, netCash: -1001 }),
      line('2025-07-01', { ...MAIN, ...NEWCO, type: 'SPINOFF', quantity: 4, price: 12, currency: 'USD', ...cells }),
    )
    return settledImport(rows, book({}), RATES, NO_CHOICES, keyed(new Map()))
  }

  it('reads the share as a percent from 1 up, as the fraction below 1 a percent cell keeps, and as text with a percent sign', () => {
    for (const costShare of [5.2051, 0.052051, '5.2051%', '5,2051 %']) {
      const settled = spinOffWith({ spinOffFrom: 'ABC', costShare })
      expect(settled.spinOffs[0]).toMatchObject({ answeredByRow: true, workbookProblem: null })
      expect(settled.dryRun.added.spinOffs.map((spinOff) => decimalText(spinOff.costShare))).toEqual(['0.052051'])
    }
  })

  it('finds the parent by its ISIN as well', () => {
    expect(spinOffWith({ spinOffFrom: 'us0000000001', costShare: 5 }).spinOffs[0]?.answeredByRow).toBe(true)
  })

  it('asks as before when a cell is blank, cannot be read or names no holding, saying which', () => {
    const blank = spinOffWith({})
    expect(blank.spinOffs[0]).toMatchObject({ answeredByRow: false, workbookProblem: null, parent: null })

    const unreadable = spinOffWith({ spinOffFrom: 'ABC', costShare: 'about five' })
    expect(unreadable.spinOffs[0]).toMatchObject({ answeredByRow: false, workbookProblem: words.questions.costShareUnreadable('about five') })
    // The parent the row names is still picked, so the share is proposed from its cost.
    expect(unreadable.spinOffs[0]?.parent).not.toBeNull()
    expect(unreadable.spinOffs[0]?.proposed).not.toBeNull()

    const stranger = spinOffWith({ spinOffFrom: 'ZZZ', costShare: 5 })
    expect(stranger.spinOffs[0]).toMatchObject({ answeredByRow: false, parent: null, workbookProblem: words.questions.parentNotFound('ZZZ') })

    expect(spinOffWith({ spinOffFrom: 'ABC', costShare: 120 }).spinOffs[0]?.answeredByRow).toBe(false)
  })
})

describe('a split answered from the splits its vendor lists', () => {
  const rows = rowsOf(
    line('2025-01-02', { ...MAIN, type: 'DEPOSIT', currency: 'USD', netCash: 5000, revolutRate: 1.04 }),
    line('2025-01-06', { ...MAIN, ...ABC, type: 'BUY', quantity: 10, price: 100, currency: 'USD', gross: -1000, commission: 1, netCash: -1001 }),
    // The rows add 30 to the 10 held, which a lookup can still call 3 for 1 as the vendor lists it.
    line('2025-06-10', { ...MAIN, ...ABC, type: 'SPLIT', quantity: 30 }),
  )
  const settle = (answer: SplitsAnswer) => settledImport(rows, book({}), RATES, NO_CHOICES, keyed(new Map()), (symbol) => (symbol === 'ABC' ? answer : { kind: 'failed', reason: 'unknown-symbol' }))

  it('takes the ratio of a split listed within a few days of the row, so the question is not asked', () => {
    const settled = settle({ kind: 'splits', splits: [{ date: '2025-06-13', newUnits: '3', oldUnits: '1' }] })
    expect(settled.splits[0]).toMatchObject({ symbol: 'ABC', listed: { newUnits: '3', oldUnits: '1' }, unlisted: null })
    expect(settled.dryRun.added.splits.map((split) => [split.newUnits, split.oldUnits])).toEqual([[3, 1]])
  })

  it('falls back to the ratio of the units held, saying why, without a key, on a failure or with no split near the day', () => {
    const cases: [SplitsAnswer, string][] = [
      [{ kind: 'no-key' }, 'no-key'],
      [{ kind: 'pending' }, 'pending'],
      [{ kind: 'failed', reason: 'limit' }, 'failed'],
      [{ kind: 'splits', splits: [{ date: '2024-06-10', newUnits: '2', oldUnits: '1' }] }, 'none-near'],
    ]
    for (const [answer, unlisted] of cases) {
      const settled = settle(answer)
      expect(settled.splits[0]).toMatchObject({ listed: null, unlisted, texts: { newUnits: '4', oldUnits: '1' } })
    }
  })
})

describe('the price source guessed for a listing', () => {
  it("takes Alpha Vantage's AMS suffix for an Amsterdam listing, as it takes DEX for Xetra", () => {
    const rows = rowsOf(
      line('2025-01-06', { ...MAIN, yahooSymbol: 'FUND.AS', brokerSymbol: 'FUND', type: 'BUY', quantity: 1, price: 10, currency: 'EUR', netCash: -10 }),
      line('2025-01-06', { ...MAIN, yahooSymbol: 'ETF.DE', brokerSymbol: 'ETF', type: 'BUY', quantity: 1, price: 10, currency: 'EUR', netCash: -10 }),
    )
    const { instruments } = workbookDryRun(rows, { book: book({}), rates: RATES, answers: NO_ANSWERS }).questions
    expect(instruments.map(({ proposal }) => [proposal.exchange, proposal.prices, proposal.sourceSymbol])).toEqual([
      ['XAMS', 'alphavantage', 'FUND.AMS'],
      ['XETR', 'alphavantage', 'ETF.DEX'],
    ])
  })
})

describe('the template download', () => {
  it('reads back through the reader with its example rows, every column and a How to fill tab', async () => {
    const bytes = await portfolioTemplateFile(words.template)
    const XLSX = await import('xlsx')
    expect(XLSX.read(bytes, { type: 'array' }).SheetNames).toEqual(['Transactions', words.template.tabName])
    const reading = await readPortfolioWorkbookFile(bytes)
    if (reading.kind !== 'read') throw new Error(reading.refusal.kind)
    expect(reading.skipped).toEqual([])
    expect(reading.rows.map((row) => row.type)).toEqual(['DEPOSIT', 'FX', 'BUY', 'DIVIDEND', 'WITHHOLDING TAX', 'SPLIT', 'SPINOFF'])
    const spinOff = reading.rows.at(-1)!
    expect([spinOff.spinOffFrom, spinOff.costShare === null ? null : decimalText(spinOff.costShare)]).toEqual(['ABC', '0.052051'])

    const settled = settledImport(reading, book({}), RATES, NO_CHOICES, keyed(new Map()))
    expect(settled.spinOffs[0]?.answeredByRow).toBe(true)
    expect(settled.splits[0]?.texts).toEqual({ newUnits: '4', oldUnits: '1' })
    expect(settled.dryRun.entries.every((entry) => entry.outcome.kind === 'new')).toBe(true)
  })
})
