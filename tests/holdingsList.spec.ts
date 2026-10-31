import { describe, expect, it } from 'vitest'

import { heldHoldings, holdingsList } from '../src/apps/investments/holdings/domain/holdingsList'
import type { HoldingsLine, HoldingsList, HoldingsView } from '../src/apps/investments/holdings/domain/holdingsList'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, STOCK_B, USD, WORKED_PRICES, WORKED_RATES, WORLD_ETF, cashMovement, instrument, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')
const BY_CLASS: HoldingsView = { grouping: 'class', find: '', sold: false, sort: null }
const SOLD_CO = instrument('sold-co', { name: 'Sold Co' })

/** The worked portfolio with a third holding bought and sold whole in 2025, for €20.00 realised. */
function withSoldHolding(): InvestmentBook {
  const records = workedPortfolio()
  return {
    ...records,
    instruments: [...records.instruments, SOLD_CO],
    cashMovements: [...records.cashMovements, cashMovement('deposit', BROKER, '2025-05-05', '100')],
    trades: [...records.trades, trade('buy', BROKER, SOLD_CO, '2025-05-05', '10', '10', '0'), trade('sell', BROKER, SOLD_CO, '2025-06-02', '10', '12', '0')],
  }
}

function listOf(records: InvestmentBook, view: Partial<HoldingsView> = {}): HoldingsList {
  return holdingsList(portfolioFigures({ book: records, prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY }), records, { ...BY_CLASS, ...view })
}

function named(line: HoldingsLine): string {
  return line.kind === 'cash' ? `${line.account} ${line.balance.currency}` : line.holding.instrument.name
}

describe("the worked portfolio's holdings on 29 Oct 2026", () => {
  it('counts the two holdings held, not the cash', () => {
    const figures = portfolioFigures({ book: withSoldHolding(), prices: WORKED_PRICES, rates: WORKED_RATES, today: TODAY })
    expect(heldHoldings(figures).map((holding) => holding.instrument)).toEqual([WORLD_ETF, STOCK_B])
  })

  it('groups by class with the stocks first, largest first, and the cash last', () => {
    const list = listOf(workedPortfolio())

    expect(list.groups.map((group) => [group.key, group.holdings, group.lines.map(named)])).toEqual([
      ['stocks', 2, ['World ETF', 'Stock B']],
      ['cash', 0, ['Broker EUR', 'Broker USD']],
    ])
    // 1,875.00 + 776.79 = 2,651.79 of value on 1,554.00 + 715.00 = 2,269.00 of cost, a gain of 321.00 + 61.79 = 382.79.
    const [stocks, cash] = list.groups
    expect(stocks).toMatchObject({ value: euros(2651.79), cost: euros(2269), gain: euros(382.79) })
    expect(stocks?.gainShare).toBeCloseTo(382.79 / 2269, 6)
    expect(stocks?.weight).toBeCloseTo(2651.79 / 3414.75, 6)
    // The World ETF +15.00 on 1,860.00 and Stock B +3.25 on 773.54.
    expect(stocks?.lastDay).toMatchObject({ earlier: euros(2633.54), later: euros(2651.79), change: euros(18.25) })
    // Euros 446.00 and $355.00 at 1.12 = 316.96, with no cost and no gain.
    expect(cash).toMatchObject({ value: euros(762.96), cost: euros(0), gain: null, gainShare: null })
  })

  it('gives each holding its gain over its cost and each balance its share of the value', () => {
    const [stocks, cash] = listOf(workedPortfolio()).groups
    const [worldEtf, stockB] = stocks?.lines ?? []

    expect(worldEtf?.kind === 'holding' ? worldEtf.gainShare : null).toBeCloseTo(321 / 1554, 6)
    expect(stockB?.kind === 'holding' ? stockB.gainShare : null).toBeCloseTo(61.79 / 715, 6)
    expect(cash?.lines.map((line) => (line.kind === 'cash' ? line.weight : null))).toEqual([446 / 3414.75, 316.96 / 3414.75].map((share) => expect.closeTo(share, 6)))
  })

  it('totals every line into the value, the cost of what is held and the last day of +€16.82', () => {
    const { total } = listOf(workedPortfolio())

    // 382.79 of gain on the holdings, and the last day's 15.00 + 3.25 + 0.00 − 1.43 of the dollar cash = 16.82.
    expect(total).toMatchObject({ value: euros(3414.75), cost: euros(2269), gain: euros(382.79), weight: 1 })
    expect(total.lastDay?.change).toBe(euros(16.82))
  })

  it('groups by currency with the cash of each currency in it, and lists everything together ungrouped', () => {
    expect(listOf(workedPortfolio(), { grouping: 'currency' }).groups.map((group) => [group.key, group.value, group.lines.map(named)])).toEqual([
      [EURO, euros(2321), ['World ETF', 'Broker EUR']],
      [USD, euros(1093.75), ['Stock B', 'Broker USD']],
    ])
    expect(listOf(workedPortfolio(), { grouping: 'none' }).groups.map((group) => [group.key, group.lines.map(named)])).toEqual([['all', ['World ETF', 'Stock B', 'Broker EUR', 'Broker USD']]])
  })

  it('finds a holding by its name whatever the case, and a balance by its account or currency', () => {
    expect(listOf(workedPortfolio(), { find: 'stock b' }).groups.flatMap((group) => group.lines.map(named))).toEqual(['Stock B'])
    expect(listOf(workedPortfolio(), { find: 'usd' }).groups.flatMap((group) => group.lines.map(named))).toEqual(['Broker USD'])
    expect(listOf(workedPortfolio(), { find: 'nothing like it' }).groups).toEqual([])
  })

  it('sorts each group by a column either way, leaving what has no figure last', () => {
    const order = (view: Partial<HoldingsView>): string[] => listOf(workedPortfolio(), { grouping: 'none', ...view }).groups.flatMap((group) => group.lines.map(named))

    expect(order({ sort: { column: 'gain', descending: false } })).toEqual(['Stock B', 'World ETF', 'Broker EUR', 'Broker USD'])
    expect(order({ sort: { column: 'value', descending: false } })).toEqual(['Broker USD', 'Broker EUR', 'Stock B', 'World ETF'])
    // Both balances are the Broker's, so they keep their own order.
    expect(order({ sort: { column: 'name', descending: true } })).toEqual(['World ETF', 'Stock B', 'Broker EUR', 'Broker USD'])
  })

  it('lists the sold holdings last with what they realised, outside the total', () => {
    const list = listOf(withSoldHolding(), { sold: true })
    const sold = list.groups.at(-1)

    // Sold for 10 × 12.00 = 120.00, bought for 100.00.
    expect(sold).toMatchObject({ key: 'sold', holdings: 1, value: euros(0), gain: euros(20), gainShare: null, weight: null })
    expect(sold?.lines.map(named)).toEqual(['Sold Co'])
    expect(list.total.gain).toBe(euros(382.79))
    expect(listOf(withSoldHolding()).groups.map((group) => group.key)).toEqual(['stocks', 'cash'])
  })
})
