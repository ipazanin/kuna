import type { LoansMonth, PlannedLoan } from '../domain/loansTogether'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import { payoffDate } from '../../bankLoans/domain/loanFigures'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries } from '../../../../shared/charts/echarts'
import { formatMoney } from '../../../../shared/money/moneyFormat'

export interface TogetherChart {
  readonly option: ChartOption
  readonly description: string
  /** Whether the chart runs past the current month, which its legend then names. */
  readonly hasAhead: boolean
}

/** The colour token of a loan's band, by its place among the loans, so a loan keeps its colour on both charts and in the legend. */
export function loanBandToken(place: number): string {
  return place < 3 ? `--loan-band-${place + 1}` : '--chart-deemphasis'
}

/** What every chart over the loans shares: one stacked area per loan, a dashed rule at the current month, and a tooltip that adds the months' total. */
function bandsOf(loans: readonly PlannedLoan[], months: readonly LoansMonth[], current: MonthKey, tokens: ChartTokens, stack: string, stepped: boolean): LineSeries[] {
  const categories = months.map((entry) => entry.month)
  return loans.map((loan, place): LineSeries => {
    const colour = tokenColour(loanBandToken(place))
    return {
      type: 'line',
      name: loan.loan.name,
      stack,
      color: colour,
      showSymbol: false,
      ...(stepped ? { step: 'end' } : {}),
      lineStyle: { width: 1.5 },
      areaStyle: { color: colour, opacity: 0.28 },
      data: months.map((entry) => entry.amounts[place] ?? null),
      ...(place === 0
        ? {
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: tokens.axis, type: 'dashed', width: 1 },
              label: { formatter: words.together.today, position: 'end', color: tokens.inkSecondary, fontSize: 11 },
              data: categories.includes(current) ? [{ xAxis: current }] : [],
            },
          }
        : {}),
    }
  })
}

function optionOf(months: readonly LoansMonth[], series: LineSeries[], tokens: ChartTokens, phone: boolean, totalLine: (total: string) => string, estimateFrom: MonthKey | null): ChartOption {
  const totals = new Map<string, LoansMonth['total']>(months.map((entry) => [entry.month, entry.total]))
  return {
    grid: { top: 24, right: 16 },
    tooltip: {
      trigger: 'axis',
      formatter: (points: unknown) =>
        axisTooltip({
          tokens,
          categoryLabel: monthAxisLabel('long'),
          formatAmount: (amount) => formatMoney(amount),
          footnotes: (month) => {
            const total = totals.get(month)
            return [...(total === undefined ? [] : [totalLine(formatMoney(total))]), ...(estimateFrom !== null && month >= estimateFrom ? [words.together.estimate] : [])]
          },
        })(shownPoints(points)),
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: months.map((entry) => entry.month),
      axisLabel: monthAxisLabels(
        months.map((entry) => entry.month),
        tokens,
        phone,
      ),
    },
    yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
    series,
  }
}

/**
 * What each loan owes at each month end, stacked, so the top of the stack is what you owe in all. A
 * dashed brass line traces that total from the current month on, where the figures are the plans',
 * with a dot on today's total.
 */
export function owedTogetherChart(
  loans: readonly PlannedLoan[],
  months: readonly LoansMonth[],
  current: MonthKey,
  freeOfDebtOn: CivilDate | null,
  tokens: ChartTokens,
  phone: boolean,
  estimateFrom: MonthKey | null,
): TogetherChart {
  const ahead = tokenColour('--loan-ahead')
  const now = months.find((entry) => entry.month === current)
  const hasAhead = months.some((entry) => entry.month > current)
  const stillToCome: LineSeries = {
    type: 'line',
    name: '',
    silent: true,
    color: ahead,
    showSymbol: false,
    lineStyle: { width: 2, type: [5, 4], color: ahead },
    z: 5,
    data: months.map((entry) => (entry.month >= current ? entry.total : null)),
    markPoint: {
      silent: true,
      symbol: 'circle',
      label: { show: false },
      data: now === undefined ? [] : [{ name: '', coord: [current, now.total], symbolSize: 8, itemStyle: { color: ahead, borderColor: tokens.surface, borderWidth: 2 } }],
    },
  }
  const first = months[0]
  const last = months.at(-1)
  const names = loans.map((loan) => loan.loan.name)
  return {
    option: optionOf(months, [...bandsOf(loans, months, current, tokens, 'owed', false), ...(hasAhead ? [stillToCome] : [])], tokens, phone, words.together.owedInAll, estimateFrom),
    description:
      first === undefined || last === undefined
        ? words.together.noMonths
        : words.together.owedDescription(names, monthLabel(first.month), monthLabel(last.month)) +
          (now === undefined ? '' : words.together.owedNow(monthLabel(now.month), formatMoney(now.total))) +
          (freeOfDebtOn === null ? '' : words.together.debtFreeIn(monthLabel(monthOf(freeOfDebtOn)))),
    hasAhead,
  }
}

/**
 * Your share of each loan's instalments in each month, stacked as steps, so a loan that ends shows as
 * a drop in the total. A brass rule under the axis runs from the current month to the end, as on a
 * loan's payments chart.
 */
export function outgoingChart(loans: readonly PlannedLoan[], months: readonly LoansMonth[], current: MonthKey, tokens: ChartTokens, phone: boolean, estimateFrom: MonthKey | null): TogetherChart {
  const ahead = tokenColour('--loan-ahead')
  const hasAhead = months.some((entry) => entry.month > current)
  const stillToCome: LineSeries = {
    type: 'line',
    name: '',
    silent: true,
    symbol: 'none',
    color: ahead,
    lineStyle: { width: 3, color: ahead },
    z: 5,
    data: months.map((entry) => (entry.month >= current ? 0 : null)),
  }
  const first = months[0]
  const last = months.at(-1)
  const now = months.find((entry) => entry.month === current)
  const endings = loans.flatMap((loan) => {
    const payoff = payoffDate(loan.plan)
    if (payoff === null || last === undefined || monthOf(payoff) >= last.month) return []
    const after = months.find((entry) => entry.month > monthOf(payoff))
    return after === undefined ? [] : [words.together.loanEnds(loan.loan.name, monthLabel(monthOf(payoff)), formatMoney(after.total))]
  })
  return {
    option: optionOf(months, [...bandsOf(loans, months, current, tokens, 'outgoing', true), ...(hasAhead ? [stillToCome] : [])], tokens, phone, words.together.outgoingInAll, estimateFrom),
    description:
      first === undefined || last === undefined
        ? words.together.noMonths
        : words.together.outgoingDescription(
            loans.map((loan) => loan.loan.name),
            monthLabel(first.month),
            monthLabel(last.month),
          ) +
          (now === undefined ? '' : words.together.outgoingNow(monthLabel(now.month), formatMoney(now.total))) +
          endings.join(''),
    hasAhead,
  }
}
