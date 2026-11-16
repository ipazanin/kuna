import { describe, expect, it } from 'vitest'

import { driversChart } from '../src/apps/investments/performance/presentation/driversChart'
import type { DrillTarget } from '../src/apps/company/filters/domain/drillTarget'
import { PROFIT_BRIDGE } from '../src/apps/company/packs/hr-doo/presentation/profitBridge'
import { monthFlowChart } from '../src/apps/spending/analytics/presentation/monthFlowChart'
import { monthKey } from '../src/shared/calendar/monthKey'
import { bridgeChart } from '../src/shared/charts/bridgeChart'
import type { BridgeBar } from '../src/shared/charts/bridgeChart'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import type { BarSeries } from '../src/shared/charts/echarts'
import { moneyFromCents } from '../src/shared/money/money'

/** Each token reads as its own name, so a series shows which one it took. */
const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

function coloursOf(series: BarSeries): readonly unknown[] {
  return (series.data ?? []).map((bar) => (bar as { itemStyle?: { color?: string } }).itemStyle?.color)
}

function seriesOf(option: unknown): readonly BarSeries[] {
  return (option as { series: readonly BarSeries[] }).series
}

const PROFIT: readonly BridgeBar<DrillTarget>[] = [
  { label: 'Revenue', kind: 'total', amount: moneyFromCents(100_000), drill: null },
  { label: 'Subsidy', kind: 'step', amount: moneyFromCents(5_000), drill: null },
  { label: 'Costs', kind: 'step', amount: moneyFromCents(-40_000), drill: null },
  { label: 'Profit', kind: 'total', amount: moneyFromCents(65_000), drill: null },
]

describe('the tones a chart draws money in', () => {
  it('draws a profit bridge, whose steps are money in and out, in the soft tones', () => {
    const chart = bridgeChart(PROFIT, TOKENS, PROFIT_BRIDGE)
    expect(coloursOf(seriesOf(chart.option)[1]!)).toEqual(['inkSecondary', 'positiveSoft', 'negativeSoft', 'inkSecondary'])
  })

  it('draws a bridge of gains and losses in the full tones', () => {
    const chart = bridgeChart(PROFIT, TOKENS, { ...PROFIT_BRIDGE, steps: 'outcome' })
    expect(coloursOf(seriesOf(chart.option)[1]!)).toEqual(['inkSecondary', 'positive', 'negative', 'inkSecondary'])
  })

  it("draws a month's income on Spending, money coming in, in the soft positive tone", () => {
    const months = [{ month: monthKey(2026, 10), income: moneyFromCents(300_000), spent: moneyFromCents(200_000), saved: moneyFromCents(100_000), savingsRate: null }]
    const chart = monthFlowChart(months, monthKey(2026, 11), TOKENS)
    expect(seriesOf(chart.option)[0]?.color).toBe('positiveSoft')
    expect(chart.legend[0]?.colour).toBe('var(--tone-positive-soft)')
  })

  it("draws what each holding added to a period's gain in the full tones, and fees in grey", () => {
    const chart = driversChart(
      [
        { label: 'Fund', amount: moneyFromCents(5_000), cost: false },
        { label: 'Bond', amount: moneyFromCents(-2_000), cost: false },
        { label: 'Fees', amount: moneyFromCents(-300), cost: true },
      ],
      TOKENS,
    )
    expect(coloursOf(seriesOf(chart.option)[0]!)).toEqual(['positive', 'negative', 'deemphasis'])
  })
})
