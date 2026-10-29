import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'

/** What a loan owes at the end of a month. */
export interface MonthBalance {
  readonly month: MonthKey
  readonly owed: Money
}

export interface BalanceChart {
  readonly option: ChartOption
  readonly description: string
}

const OWED = 'Owed'
const PLANNED = 'Planned'

/**
 * The month-end balance as a line, solid up to the month on the day and dashed after it, where the
 * figures are the plan's. The two lines share the month on the day, so they join.
 */
export function balanceChart(months: readonly MonthBalance[], current: MonthKey, tokens: ChartTokens): BalanceChart {
  const categories: string[] = months.map((entry) => entry.month)
  const hasPlan = months.some((entry) => entry.month > current)
  const colour = tokens.series[0] ?? tokens.ink
  const line = (name: string, shown: (month: MonthKey) => boolean, dashed: boolean): LineSeries => ({
    type: 'line',
    name,
    color: colour,
    showSymbol: false,
    lineStyle: { width: 2, ...(dashed ? { type: 'dashed' } : {}) },
    areaStyle: { color: colour, opacity: 0.08 },
    data: months.map((entry) => (shown(entry.month) ? entry.owed : null)),
  })
  const first = months[0]
  const last = months.at(-1)
  const now = months.find((entry) => entry.month === current) ?? last
  return {
    option: {
      grid: { top: 16, right: 16 },
      tooltip: { trigger: 'axis', formatter: axisTooltip({ tokens, categoryLabel: monthAxisLabel('long'), formatAmount: (amount) => formatMoney(amount) }) },
      xAxis: { type: 'category', boundaryGap: false, data: categories, axisLabel: { color: tokens.inkMuted, formatter: monthAxisLabel('short') } },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [line(OWED, (month) => month <= current, false), ...(hasPlan ? [line(PLANNED, (month) => month >= current, true)] : [])],
    },
    description:
      first === undefined || last === undefined || now === undefined
        ? 'No months to show.'
        : `What the loan owes at each month end from ${monthLabel(first.month)} to ${monthLabel(last.month)}. ` +
          `At the end of ${monthLabel(now.month)} it is ${formatMoney(now.owed)}${hasPlan ? `, and the plan reaches ${formatMoney(last.owed)} by ${monthLabel(last.month)}` : ''}.`,
  }
}
