import type { BarSeries, ChartOption, LineSeries } from '../../../shared/charts/echarts'
import { BAR_END_DOWN, BAR_END_RIGHT, BAR_END_UP, markIncomplete, moneyAxisLabel, stackGap } from '../../../shared/charts/chartTheme'
import type { ChartTokens } from '../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../shared/charts/chartTooltip'
import { formatCompactMoney, formatMoney, formatPercent } from '../../../shared/money/moneyFormat'

/** Made-up figures in cents for a small one-person company. None of it comes from a real ledger. */
export const SAMPLE_MONTHS = ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026']
const CURRENT_MONTH_INDEX = SAMPLE_MONTHS.length - 1
const INCOMPLETE_MONTHS = [SAMPLE_MONTHS[CURRENT_MONTH_INDEX] ?? '']
const INCOMPLETE = SAMPLE_MONTHS.map((_, index) => index === CURRENT_MONTH_INDEX)

const INCOME = [1120000, 1310000, 980000, 1045000, 1240000, 1190000, 1380000, 1265000, 905000, 870000, 1420000, 610000]
const OPERATING = [-262000, -341000, -228000, -244000, -297000, -251000, -318000, -276000, -305000, -198000, -332000, -121000]
const TAXES = [-188000, -201000, -176000, -179000, -192000, -185000, -207000, -198000, -181000, -176000, -214000, -95000]
const OWNER_PAY = [-415000, -460000, -390000, -405000, -430000, -410000, -470000, -445000, -380000, -360000, -480000, -200000]

function netByMonth(): number[] {
  return INCOME.map((income, index) => income + (OPERATING[index] ?? 0) + (TAXES[index] ?? 0) + (OWNER_PAY[index] ?? 0))
}

function rollingThree(values: readonly number[]): (number | null)[] {
  return values.map((_, index) => {
    if (index < 2) return null
    return Math.round(((values[index] ?? 0) + (values[index - 1] ?? 0) + (values[index - 2] ?? 0)) / 3)
  })
}

const monthAxis = (tokens: ChartTokens) => ({
  type: 'category' as const,
  data: SAMPLE_MONTHS,
  axisLabel: { color: tokens.inkMuted, formatter: (month: string) => month.slice(0, 3) },
})

export function incomeByMonth(tokens: ChartTokens): ChartOption {
  const completeIncome = INCOME.slice(0, CURRENT_MONTH_INDEX)
  return {
    grid: { top: 16 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens, incompleteCategories: INCOMPLETE_MONTHS }) },
    xAxis: monthAxis(tokens),
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series: [
      {
        type: 'bar',
        name: 'Income',
        color: tokens.buckets.income,
        data: markIncomplete(INCOME, INCOMPLETE, tokens),
      },
      {
        type: 'line',
        name: 'Three-month average',
        color: tokens.ink,
        lineStyle: { width: 2 },
        data: [...rollingThree(completeIncome), null],
        z: 3,
      },
    ],
  }
}

export function incomeAgainstCosts(tokens: ChartTokens): ChartOption {
  const costSeries = (name: string, colour: string, amounts: readonly number[], outermost: boolean): BarSeries => ({
    type: 'bar',
    name,
    stack: 'costs',
    color: colour,
    itemStyle: { ...stackGap(tokens), borderRadius: outermost ? BAR_END_DOWN : 0 },
    data: markIncomplete(amounts, INCOMPLETE, tokens),
  })
  const net: LineSeries = {
    type: 'line',
    name: 'Net',
    color: tokens.ink,
    showSymbol: true,
    symbolSize: 6,
    data: netByMonth(),
    z: 4,
  }
  return {
    grid: { top: 16 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: axisTooltip({
        tokens,
        incompleteCategories: INCOMPLETE_MONTHS,
        // Costs read positive. Only the net keeps its sign.
        formatAmount: (amount, seriesName) => formatMoney(amount, seriesName === 'Net' ? 'negative' : 'magnitude'),
      }),
    },
    xAxis: { ...monthAxis(tokens), axisLine: { onZero: true, lineStyle: { color: tokens.axis } } },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series: [
      {
        type: 'bar',
        name: 'Income',
        stack: 'income',
        color: tokens.buckets.income,
        // Income and the cost stack share one slot per month, so they meet at zero.
        barGap: '-100%',
        itemStyle: { borderRadius: BAR_END_UP },
        data: markIncomplete(INCOME, INCOMPLETE, tokens),
      },
      costSeries('Operating', tokens.buckets.operating, OPERATING, false),
      costSeries('Taxes', tokens.buckets.taxes, TAXES, false),
      costSeries('Owner pay', tokens.buckets['owner-pay'], OWNER_PAY, true),
      net,
    ],
  }
}

export function cashAtMonthEnd(tokens: ChartTokens): ChartOption {
  const balances = [3120000, 3384000, 3455000, 3622000, 3810000, 3965000, 4212000, 4318000, 4290000, 4402000, 4697000, 4821000]
  const colour = tokens.series[2] ?? tokens.ink
  return {
    // Room on the right for the end label.
    grid: { top: 16, right: 52 },
    tooltip: { trigger: 'axis', formatter: axisTooltip({ tokens, incompleteCategories: INCOMPLETE_MONTHS }) },
    xAxis: { ...monthAxis(tokens), boundaryGap: false },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens), scale: false },
    series: [
      {
        type: 'line',
        name: 'Cash at month end',
        color: colour,
        areaStyle: { color: colour, opacity: 0.1 },
        data: balances,
        endLabel: {
          show: true,
          color: tokens.ink,
          fontWeight: 600,
          formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? formatCompactMoney(value) : ''),
        },
      },
    ],
  }
}

const CATEGORIES = ['External contractors', 'Software', 'Accounting', 'Travel', 'Equipment', 'Telecom', 'Bank fees']
const CATEGORY_NOW = [1182000, 642000, 480000, 391000, 260000, 118000, 46000]
const CATEGORY_BEFORE = [940000, 511000, 480000, 512000, 655000, 121000, 52000]

export function costsByCategory(tokens: ChartTokens): ChartOption {
  const categoryAxis = (shown: boolean) => ({
    type: 'category' as const,
    data: [...CATEGORIES].reverse(),
    show: shown,
    axisLine: { show: false },
    axisLabel: { color: tokens.inkSecondary, fontSize: 12 },
  })
  return {
    grid: { top: 4, right: 56 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: axisTooltip({ tokens }) },
    xAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    // The ghost sits on a hidden twin of the category axis, so both bars centre on the same row.
    yAxis: [categoryAxis(true), categoryAxis(false)],
    series: [
      {
        type: 'bar',
        name: 'Prior 12 months',
        yAxisIndex: 1,
        barWidth: 20,
        color: tokens.ghost,
        itemStyle: { borderRadius: BAR_END_RIGHT },
        data: [...CATEGORY_BEFORE].reverse(),
        z: 1,
      },
      {
        type: 'bar',
        name: 'Last 12 months',
        barWidth: 10,
        color: tokens.buckets.operating,
        itemStyle: { borderRadius: BAR_END_RIGHT },
        label: {
          show: true,
          position: 'right',
          distance: 8,
          color: tokens.inkSecondary,
          fontSize: 11,
          formatter: ({ value }: { value: unknown }) => (typeof value === 'number' ? formatCompactMoney(value) : ''),
        },
        data: [...CATEGORY_NOW].reverse(),
        z: 2,
      },
    ],
  }
}

const WINDOWS = ['Last 3 months', 'Last 12 months', 'All time']
const SPLIT = {
  kept: [0.31, 0.27, 0.24],
  operating: [0.22, 0.24, 0.27],
  taxes: [0.15, 0.16, 0.17],
  ownerPay: [0.32, 0.33, 0.32],
}

export function everyEuroEarned(tokens: ChartTokens): ChartOption {
  const segment = (name: string, colour: string, shares: readonly number[], outermost: boolean): BarSeries => ({
    type: 'bar',
    name,
    stack: 'euro',
    barWidth: 22,
    color: colour,
    itemStyle: { ...stackGap(tokens), borderRadius: outermost ? BAR_END_RIGHT : 0 },
    label: {
      show: true,
      color: tokens.onFill,
      fontSize: 11,
      fontWeight: 600,
      formatter: ({ value }: { value: unknown }) => (typeof value === 'number' && value >= 0.12 ? formatPercent(value) : ''),
    },
    data: [...shares].reverse(),
  })
  return {
    grid: { top: 4, right: 8 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: axisTooltip({ tokens, formatAmount: (share) => formatPercent(share) }),
    },
    xAxis: { type: 'value', max: 1, axisLabel: { formatter: (share: number) => formatPercent(share) } },
    yAxis: { type: 'category', data: [...WINDOWS].reverse(), axisLine: { show: false }, axisLabel: { color: tokens.inkSecondary, fontSize: 12 } },
    series: [
      segment('Kept', tokens.buckets.income, SPLIT.kept, false),
      segment('Operating', tokens.buckets.operating, SPLIT.operating, false),
      segment('Taxes', tokens.buckets.taxes, SPLIT.taxes, false),
      segment('Owner pay', tokens.buckets['owner-pay'], SPLIT.ownerPay, true),
    ],
  }
}
