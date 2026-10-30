import { describe, expect, it } from 'vitest'

import { investmentLots, taxFreeFrom, taxSplitOf } from '../src/apps/investments/holdings/domain/lots'
import type { InstrumentLots } from '../src/apps/investments/holdings/domain/lots'
import type { Instrument } from '../src/apps/investments/workbook/domain/instrument'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { decimalText } from '../src/shared/money/decimal'
import { BROKER, USD, account, book, decimal, instrument, spinOff, split, trade, unitTransfer } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const ETF = instrument('etf')

function lotsOf(records: InvestmentBook, what: Instrument): InstrumentLots {
  return investmentLots(records).get(what.id)!
}

function openLots(lots: InstrumentLots): [string, string, number, string][] {
  return lots.open.map((lot) => [lot.opened, decimalText(lot.quantity), lot.cost / 100, lot.taxFreeFrom])
}

describe('FIFO lots', () => {
  it("closes the oldest lot first and splits the sale between lots past two years and the rest, lane 3's example", () => {
    const records = book({
      instruments: [ETF],
      trades: [trade('buy', BROKER, ETF, '2024-01-15', '10', '100', '1'), trade('buy', BROKER, ETF, '2025-06-10', '10', '120', '1'), trade('sell', BROKER, ETF, '2026-03-02', '15', '130', '1')],
    })

    const lots = lotsOf(records, ETF)
    const [sale] = lots.sales

    // The sale's 15 × 130.00 = 1,950.00 and its 1.00 fee split 10 : 5, so 1,300.00 and 650.00, 0.67 and 0.33.
    // Lot 1: 1,300.00 − 0.67 − 1,001.00 = 298.33, held past 16 Jan 2026. Lot 2: half of 1,201.00 is 600.50, so 650.00 − 0.33 − 600.50 = 49.17.
    expect(sale!.lines.map((line) => [line.opened, decimalText(line.quantity), line.cost / 100, line.proceeds / 100, line.fees / 100, line.gain / 100, line.taxFree])).toEqual([
      ['2024-01-15', '10', 1001, 1300, 0.67, 298.33, true],
      ['2025-06-10', '5', 600.5, 650, 0.33, 49.17, false],
    ])
    expect(sale!.lines.map((line) => line.daysHeld)).toEqual([777, 265])
    expect(taxSplitOf(sale!)).toEqual({ taxFree: { quantity: decimal('10'), gain: euros(298.33) }, taxable: { quantity: decimal('5'), gain: euros(49.17) } })
    // 298.33 + 49.17 = 347.50 of gain, and five units stay open at the other 600.50.
    expect(sale!.lines.reduce((total, line) => total + line.gain, 0)).toBe(euros(347.5))
    expect(openLots(lots)).toEqual([['2025-06-10', '5', 600.5, '2027-06-11']])
    expect(decimalText(lots.open[0]!.costInCurrency)).toBe('600.5')
  })

  it('splits a €1.00 fee over three one-unit lots as €0.33, €0.33 and €0.34', () => {
    const records = book({
      instruments: [ETF],
      trades: [
        trade('buy', BROKER, ETF, '2026-01-05', '1', '50', '0'),
        trade('buy', BROKER, ETF, '2026-02-05', '1', '50', '0'),
        trade('buy', BROKER, ETF, '2026-03-05', '1', '50', '0'),
        trade('sell', BROKER, ETF, '2026-04-01', '3', '60', '1'),
      ],
    })

    // Each lot gets a third: 0.333 rounds to 0.33 twice and the last takes the rest, 1.00 − 0.66 = 0.34.
    expect(lotsOf(records, ETF).sales[0]!.lines.map((line) => [line.proceeds / 100, line.fees / 100, line.gain / 100])).toEqual([
      [60, 0.33, 9.67],
      [60, 0.33, 9.67],
      [60, 0.34, 9.66],
    ])
  })

  it('keeps €2,000.00 of cost over 40 units after a 4-for-1 split', () => {
    const records = book({ instruments: [ETF], trades: [trade('buy', BROKER, ETF, '2025-05-02', '10', '199.8', '2')], splits: [split(ETF, '2026-06-10', 4, 1)] })

    // 10 × 199.80 + 2.00 = 2,000.00 for 10 units, then 40 units for the same 2,000.00.
    const lots = lotsOf(records, ETF)
    expect(openLots(lots)).toEqual([['2025-05-02', '40', 2000, '2027-05-03']])
    expect(decimalText(lots.units.get(BROKER.id)!)).toBe('40')
  })

  it('turns 300 units into exactly 100 in a 1-for-3 split, so selling 100 closes the holding', () => {
    const stock = instrument('stock', { currency: USD })
    const records = book({
      instruments: [stock],
      trades: [trade('buy', BROKER, stock, '2025-05-02', '300', '10', '3', '1.1'), trade('sell', BROKER, stock, '2026-08-03', '100', '33', '0', '1.16')],
      splits: [split(stock, '2026-07-01', 1, 3)],
    })

    const lots = lotsOf(records, stock)
    expect(lots.refused).toEqual([])
    expect(lots.open).toEqual([])
    expect(decimalText(lots.sales[0]!.lines[0]!.quantity)).toBe('100')
    expect(decimalText(lots.units.get(BROKER.id)!)).toBe('0')
  })

  it("moves a spin-off's cost share off each parent lot to a lot of the new instrument with the parent lot's day", () => {
    const other = account('other')
    const parent = instrument('parent')
    const received = instrument('received')
    const records = book({
      instruments: [parent, received],
      trades: [trade('buy', BROKER, parent, '2021-03-01', '10', '100', '0'), trade('buy', other, parent, '2025-02-03', '10', '50', '0')],
      spinOffs: [spinOff(parent, received, '2025-11-17', '4', '0.1813')],
    })

    const lots = investmentLots(records)
    // 18.13% of the parent's 1,500.00 is 271.95. The lots weigh 1,000.00 : 500.00, so 181.30 and the rest, 90.65.
    // The 4 units received split 10 : 10 by the lots' quantities, and so do the two accounts holding the parent.
    expect(openLots(lots.get(parent.id)!)).toEqual([
      ['2021-03-01', '10', 818.7, '2023-03-02'],
      ['2025-02-03', '10', 409.35, '2027-02-04'],
    ])
    expect(openLots(lots.get(received.id)!)).toEqual([
      ['2021-03-01', '2', 181.3, '2023-03-02'],
      ['2025-02-03', '2', 90.65, '2027-02-04'],
    ])
    expect([decimalText(lots.get(received.id)!.units.get(BROKER.id)!), decimalText(lots.get(received.id)!.units.get(other.id)!)]).toEqual(['2', '2'])

    const sales = [trade('sell', BROKER, received, '2026-01-15', '2', '70', '0'), trade('sell', other, received, '2026-01-15', '2', '70', '0')]
    const sold = investmentLots({ ...records, trades: [...records.trades, ...sales] }).get(received.id)!
    // Each account sells the 2 units it received, and FIFO closes the oldest lot first whichever account sells. 2 × 70.00
    // = 140.00 against 181.30 is a loss of 41.30, tax-free from the parent's day. Against 90.65 it is a gain of 49.35, still taxable.
    expect(sold.refused).toEqual([])
    expect(sold.sales.flatMap((sale) => sale.lines.map((line) => [line.opened, decimalText(line.quantity), line.cost / 100, line.gain / 100, line.taxFree]))).toEqual([
      ['2021-03-01', '2', 181.3, -41.3, true],
      ['2025-02-03', '2', 90.65, 49.35, false],
    ])
  })

  it('moves units between accounts and closes nothing, so the lots keep their days and costs', () => {
    const other = account('other')
    const records = book({
      instruments: [ETF],
      trades: [trade('buy', BROKER, ETF, '2024-04-02', '8', '100', '2'), trade('sell', other, ETF, '2026-09-01', '3', '140', '1')],
      transfers: [unitTransfer(BROKER, other, '2025-06-02', ETF, '8')],
    })

    const lots = lotsOf(records, ETF)
    // 8 × 100.00 + 2.00 = 802.00. The sale of 3 closes 3/8 of it, 300.75, past two years since the buy, not the transfer.
    expect(lots.sales[0]!.lines.map((line) => [line.opened, line.cost / 100, line.taxFree])).toEqual([['2024-04-02', 300.75, true]])
    expect(openLots(lots)).toEqual([['2024-04-02', '5', 501.25, '2026-04-03']])
    expect([decimalText(lots.units.get(BROKER.id)!), decimalText(lots.units.get(other.id)!)]).toEqual(['0', '5'])
  })

  it('refuses a sale beyond what the lots hold on its day and closes nothing for it', () => {
    const records = book({ instruments: [ETF], trades: [trade('sell', BROKER, ETF, '2026-01-05', '5', '100', '0'), trade('buy', BROKER, ETF, '2026-02-02', '5', '90', '0')] })

    const lots = lotsOf(records, ETF)
    expect(lots.refused.map((refused) => refused.date)).toEqual(['2026-01-05'])
    expect(lots.sales).toEqual([])
    expect(openLots(lots)).toEqual([['2026-02-02', '5', 450, '2028-02-03']])
  })

  it('refuses a sale or a transfer beyond what its account holds, though other accounts hold enough, and moves nothing for it', () => {
    const other = account('other')
    const records = book({
      instruments: [ETF],
      trades: [trade('buy', BROKER, ETF, '2025-01-06', '10', '100', '0'), trade('sell', other, ETF, '2026-01-05', '4', '110', '0'), trade('sell', BROKER, ETF, '2026-03-02', '12', '110', '0')],
      transfers: [unitTransfer(other, BROKER, '2026-02-02', ETF, '3'), unitTransfer(BROKER, other, '2026-04-01', ETF, '6')],
    })

    const lots = lotsOf(records, ETF)
    // The other account holds nothing when it sells 4 and when it sends 3, and the broker holds 10 when it sells 12.
    expect(lots.refused.map((refused) => refused.id)).toEqual([records.trades[1]!.id, records.transfers[0]!.id, records.trades[2]!.id])
    expect(lots.sales).toEqual([])
    expect(openLots(lots)).toEqual([['2025-01-06', '10', 1000, '2027-01-07']])
    expect([decimalText(lots.units.get(BROKER.id)!), decimalText(lots.units.get(other.id)!)]).toEqual(['4', '6'])
  })

  it('shares a 1-for-3 split of three lots of 100 so they add up to exactly 100, and a sale of 100 closes all three', () => {
    const records = book({
      instruments: [ETF],
      trades: [
        trade('buy', BROKER, ETF, '2025-01-06', '100', '10', '0'),
        trade('buy', BROKER, ETF, '2025-02-03', '100', '10', '0'),
        trade('buy', BROKER, ETF, '2025-03-03', '100', '10', '0'),
        trade('sell', BROKER, ETF, '2026-08-03', '100', '33', '0'),
      ],
      splits: [split(ETF, '2026-07-01', 1, 3)],
    })

    // 300 units scaled once is 100. Each of the first two lots gets 33.333333333333 and the last takes the rest.
    const lots = investmentLots({ ...records, trades: records.trades.slice(0, 3) }).get(ETF.id)!
    expect(lots.open.map((lot) => decimalText(lot.quantity))).toEqual(['33.333333333333', '33.333333333333', '33.333333333334'])
    expect(decimalText(lots.units.get(BROKER.id)!)).toBe('100')

    const sold = lotsOf(records, ETF)
    expect(sold.refused).toEqual([])
    expect(sold.open).toEqual([])
    expect(sold.sales[0]!.lines.map((line) => line.cost / 100)).toEqual([1000, 1000, 1000])
    expect(decimalText(sold.units.get(BROKER.id)!)).toBe('0')
  })

  it('counts a sale on the day a lot turns tax-free as tax-free, and one the day before as taxable', () => {
    const records = book({
      instruments: [ETF],
      trades: [trade('buy', BROKER, ETF, '2024-01-15', '2', '100', '0'), trade('sell', BROKER, ETF, '2026-01-15', '1', '120', '0'), trade('sell', BROKER, ETF, '2026-01-16', '1', '120', '0')],
    })

    // The lot turns tax-free on 16 Jan 2026, the day after its second anniversary.
    expect(lotsOf(records, ETF).sales.map((sale) => [sale.trade.date, sale.lines[0]!.taxFree])).toEqual([
      ['2026-01-15', false],
      ['2026-01-16', true],
    ])
  })

  it("takes a day's split before its trades and its buys before its sales, whatever the file's order", () => {
    const records = book({
      instruments: [ETF],
      trades: [trade('sell', BROKER, ETF, '2026-03-02', '25', '11', '0'), trade('buy', BROKER, ETF, '2026-03-02', '5', '10', '0'), trade('buy', BROKER, ETF, '2026-01-05', '2', '100', '0')],
      splits: [split(ETF, '2026-03-02', 10, 1)],
    })

    // The 2 units become 20 before the day's buy of 5, so the sale of 25 closes both lots.
    const lots = lotsOf(records, ETF)
    expect(lots.refused).toEqual([])
    expect(lots.sales[0]!.lines.map((line) => [line.opened, decimalText(line.quantity), line.cost / 100])).toEqual([
      ['2026-01-05', '20', 200],
      ['2026-03-02', '5', 50],
    ])
  })
})

describe('taxFreeFrom', () => {
  it('is the day after the second anniversary, and 1 March for a lot bought on 29 February', () => {
    expect(taxFreeFrom(civil('2024-01-15'))).toBe('2026-01-16')
    expect(taxFreeFrom(civil('2024-02-29'))).toBe('2026-03-01')
    expect(taxFreeFrom(civil('2024-12-31'))).toBe('2027-01-01')
  })
})
