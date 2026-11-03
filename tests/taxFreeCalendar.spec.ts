import { describe, expect, it } from 'vitest'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { isAtALoss, taxFreeCalendar } from '../src/apps/investments/tax/domain/taxFreeCalendar'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, STOCK_B, WORKED_RATES, WORLD_ETF, cashMovement, priceBookOf, trade, workedPortfolio } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

/** Stock B closes at $47.00, below what its lot cost. */
const PRICES = priceBookOf(
  new Map<Instrument, readonly CloseRow[]>([
    [WORLD_ETF, [['2026-10-29', '125']]],
    [STOCK_B, [['2026-10-29', '47']]],
  ]),
)

function calendarOn(records: InvestmentBook, today: string) {
  const day = civil(today)
  return taxFreeCalendar(portfolioFigures({ book: records, prices: PRICES, rates: WORKED_RATES, today: day }), day)
}

describe("the worked portfolio's tax-free calendar on 29 Oct 2026", () => {
  const calendar = calendarOn(workedPortfolio(), '2026-10-29')

  it('turns the 10 World ETF bought on 2 Jan 2025 tax-free on 3 Jan 2027 and the 15 Stock B bought on 3 Mar 2025 on 4 Mar 2027', () => {
    expect(calendar.map((month) => month.month)).toEqual(['2027-01', '2027-03', '2027-07'])
    expect(calendar.map((month) => month.lots.map((entry) => [entry.holding.instrument.name, decimalText(entry.lot.quantity), entry.lot.opened, entry.lot.taxFreeFrom]))).toEqual([
      [['World ETF', '10', '2025-01-02', '2027-01-03']],
      [['Stock B', '15', '2025-03-03', '2027-03-04']],
      [['World ETF', '5', '2025-07-01', '2027-07-02']],
    ])
  })

  it('values the Stock B lot at €629.46 against €715.00, at a loss of €85.54', () => {
    // 15 × $47.00 = $705.00 at 1.12. The lot kept 15 of the 20 units bought for $1,001.00 at 1.05, which cost €953.33.
    const [stock] = calendar[1]?.lots ?? []
    expect(stock).toMatchObject({ value: euros(629.46), gain: euros(-85.54) })
    expect(stock?.lot.cost).toBe(euros(715))
    expect(stock === undefined ? false : isAtALoss(stock)).toBe(true)
  })

  it("shares World ETF's €1,875.00 between its lots by their units", () => {
    expect(calendar.flatMap((month) => month.lots.filter((entry) => entry.holding.instrument.id === WORLD_ETF.id).map((entry) => [entry.value, entry.gain]))).toEqual([
      [euros(1250), euros(248)],
      [euros(625), euros(73)],
    ])
  })
})

describe('the tax-free calendar', () => {
  it('leaves out a lot that is tax-free already', () => {
    expect(calendarOn(workedPortfolio(), '2027-01-03').map((month) => month.month)).toEqual(['2027-03', '2027-07'])
  })

  it('shows every lot not yet tax-free, up to one bought on the day itself, and tells apart two lots bought on one day', () => {
    const records = workedPortfolio()
    const bought = {
      ...records,
      cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2026-10-28', '500')],
      trades: [
        ...records.trades,
        trade('buy', BROKER, WORLD_ETF, '2026-10-28', '1', '124', '0'),
        trade('buy', BROKER, WORLD_ETF, '2026-10-29', '1', '125', '0'),
        trade('buy', BROKER, WORLD_ETF, '2026-10-29', '2', '125', '0'),
      ],
    }
    const calendar = calendarOn(bought, '2026-10-29')
    expect(calendar.at(-1)).toMatchObject({ month: '2028-10' })
    const lots = calendar.at(-1)?.lots ?? []
    expect(lots.map((entry) => [entry.lot.taxFreeFrom, decimalText(entry.lot.quantity)])).toEqual([
      ['2028-10-29', '1'],
      ['2028-10-30', '1'],
      ['2028-10-30', '2'],
    ])
    expect(new Set(lots.map((entry) => entry.place)).size).toBe(3)
  })

  it('gives a holding with no price no value and no gain', () => {
    const records = workedPortfolio()
    const day = civil('2026-10-29')
    const calendar = taxFreeCalendar(portfolioFigures({ book: records, prices: priceBookOf(new Map()), rates: WORKED_RATES, today: day }), day)
    expect(calendar[0]?.lots[0]).toMatchObject({ value: null, gain: null })
    expect(calendar.flatMap((month) => month.lots).some(isAtALoss)).toBe(false)
  })
})
