import { describe, expect, it, vi } from 'vitest'

import type { PeriodGains } from '../src/apps/investments/performance/domain/periodGains'
import { gainBridgeChart } from '../src/apps/investments/performance/presentation/gainBridgeChart'
import { words } from '../src/apps/investments/performance/presentation/words'
import { bridgeChart } from '../src/shared/charts/bridgeChart'
import type { BridgeBar, BridgeWording } from '../src/shared/charts/bridgeChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import type { BarSeries } from '../src/shared/charts/echarts'
import { civil, euros } from './fixtures/ledger'
import { moneyFromCents } from '../src/shared/money/money'

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

// The gain bridge reads its transfer colour from the page, which a spec has none of, so each token reads as its own name.
vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => token }))

const WORDING: BridgeWording<string> = {
  raises: 'Raises',
  lowers: 'Lowers',
  total: 'Total',
  residual: 'Other',
  transfer: { label: 'Moved', colour: 'moved-colour' },
  amount: 'Amount',
  description: (bars) => bars.map((bar) => bar.label).join(', '),
}

const PROFIT: readonly BridgeBar<string>[] = [
  { label: 'Start', kind: 'total', amount: moneyFromCents(1000), drill: 'start' },
  { label: 'Sales', kind: 'step', amount: moneyFromCents(500), drill: null },
  { label: 'Costs', kind: 'step', amount: moneyFromCents(-800), drill: 'costs' },
  { label: 'Moved', kind: 'transfer', amount: moneyFromCents(100), drill: null },
  { label: 'Fee', kind: 'residual', amount: moneyFromCents(-30), drill: null },
  { label: 'End', kind: 'total', amount: moneyFromCents(770), drill: null },
]

function seriesOf(option: unknown): readonly [BarSeries, BarSeries] {
  return (option as { series: readonly [BarSeries, BarSeries] }).series
}

function gainsOf(amounts: Partial<Record<'start' | 'putIn' | 'takenOut' | 'end' | 'price' | 'currency' | 'realised' | 'fees', number>>): PeriodGains {
  const of = (amount: number | undefined) => euros(amount ?? 0)
  return {
    from: civil('2026-01-01'),
    to: civil('2026-10-30'),
    start: of(amounts.start),
    putIn: of(amounts.putIn),
    takenOut: of(amounts.takenOut),
    end: of(amounts.end),
    price: of(amounts.price),
    currency: of(amounts.currency),
    realised: of(amounts.realised),
    income: { gross: euros(0), withheld: euros(0), received: euros(0) },
    fees: of(amounts.fees),
    holdings: [],
    currencyOnCash: euros(0),
    incomeOnCash: euros(0),
    tradingFees: euros(0),
  }
}

describe('the shared bridge chart', () => {
  it('starts a total at zero and every other bar where the one before it ended, on an axis from zero', () => {
    const chart = bridgeChart(PROFIT, TOKENS, WORDING)
    const [base, shown] = seriesOf(chart.option)

    expect(base.data).toEqual([0, 1000, 1500, 700, 800, 0])
    expect(shown.data).toEqual([
      { value: 1000, itemStyle: { color: 'inkSecondary', borderRadius: 2 } },
      { value: 500, itemStyle: { color: 'positive', borderRadius: 2 } },
      { value: -800, itemStyle: { color: 'negative', borderRadius: 2 } },
      { value: 100, itemStyle: { color: 'moved-colour', borderRadius: 2 } },
      { value: -30, itemStyle: { color: 'deemphasis', borderRadius: 2 } },
      { value: 770, itemStyle: { color: 'inkSecondary', borderRadius: 2 } },
    ])
    expect((chart.option as { xAxis: { scale?: boolean } }).xAxis.scale).toBeUndefined()
    expect(chart.legend).toEqual([
      { label: 'Raises', colour: 'positive' },
      { label: 'Lowers', colour: 'negative' },
      { label: 'Total', colour: 'inkSecondary' },
      { label: 'Moved', colour: 'moved-colour' },
      { label: 'Other', colour: 'deemphasis' },
    ])
    expect(chart.description).toBe('Start, Sales, Costs, Moved, Fee, End')
    expect(chart.drillAt({ dataIndex: 2 } as Parameters<typeof chart.drillAt>[0])).toBe('costs')
  })

  it('names a transfer as other money when the caller gives no colour for it', () => {
    const { transfer: _transfer, ...untransferred } = WORDING
    const chart = bridgeChart(PROFIT, TOKENS, untransferred)

    expect(seriesOf(chart.option)[1].data?.[3]).toEqual({ value: 100, itemStyle: { color: 'deemphasis', borderRadius: 2 } })
    expect(chart.legend.map((entry) => entry.label)).toEqual(['Raises', 'Lowers', 'Total', 'Other'])
  })

  it('runs steps on from a start written beside it, on an axis that fits the bars, with no total in the legend', () => {
    const { total: _total, ...steps } = WORDING
    const chart = bridgeChart(
      [
        { label: 'Put in', kind: 'transfer', amount: moneyFromCents(2000), drill: null },
        { label: 'Price', kind: 'step', amount: moneyFromCents(-300), drill: null },
        { label: 'Fees', kind: 'residual', amount: moneyFromCents(-20), drill: null },
      ],
      TOKENS,
      steps,
      50_000,
    )
    const [base, shown] = seriesOf(chart.option)

    expect(base.data).toEqual([50_000, 52_000, 51_700])
    expect(shown.data?.map((bar) => (bar as { value: number }).value)).toEqual([2000, -300, -20])
    expect((chart.option as { xAxis: { scale?: boolean } }).xAxis.scale).toBe(true)
    expect(chart.legend.map((entry) => entry.label)).toEqual(['Lowers', 'Moved', 'Other'])
  })
})

describe("the period's gain bridge", () => {
  it('draws only the steps that moved the value, from the value at the start', () => {
    const chart = gainBridgeChart(gainsOf({ start: 10_000, putIn: 500, price: 250, fees: -3, end: 10_747 }), TOKENS)
    const [base, shown] = seriesOf(chart.option)

    expect(chart.still).toBe(false)
    expect((chart.option as { yAxis: { data: readonly string[] } }).yAxis.data).toEqual([words.bridge.putIn, words.bridge.price, words.bridge.fees])
    // 10,000.00 at the start, then 500.00 put in and 250.00 of price, so the fees start at 10,750.00.
    expect(base.data).toEqual([1_000_000, 1_050_000, 1_075_000])
    expect(shown.data?.map((bar) => (bar as { itemStyle: { color: string } }).itemStyle.color)).toEqual(['--invest-portfolio', 'positive', 'deemphasis'])
  })

  it('has no bar to draw when nothing moved the value', () => {
    const chart = gainBridgeChart(gainsOf({ start: 10_000, end: 10_000 }), TOKENS)

    expect(chart.still).toBe(true)
    expect(seriesOf(chart.option)[1].data).toEqual([])
  })
})
