import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { dotReach, markSize, namedFirst, nearestDotLines } from '../../../../shared/charts/chartDots'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries, ScatterSeries } from '../../../../shared/charts/echarts'
import { ZERO, addMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** What a loan owes at the end of a month. */
export interface MonthBalance {
  readonly month: MonthKey
  readonly owed: Money
}

/** Something that changed a loan on a day, which the chart marks with a dot on its month. */
export interface BalanceMove {
  readonly date: CivilDate
  /** What happened, in words, such as Repaid or Instalment 43. */
  readonly kind: string
  /** Null for a change with no amount of its own, such as a new rate. */
  readonly amount: Money | null
  readonly note: string
  readonly effect: 'lowers' | 'raises' | 'rate'
}

export interface BalanceChart {
  readonly option: ChartOption
  readonly description: string
  /** The lines and the kinds of dot the chart draws. */
  readonly legend: readonly LegendEntry[]
}

export interface BalanceMarks {
  /** The colour token of what is owed so far, the loan's direction. */
  readonly token: string
  /** Every move to mark, in any order. A move outside the chart's months is left out. */
  readonly moves?: readonly BalanceMove[]
  /** The first month the plan works out at a variable rate. A wide screen marks it on the chart and every width notes it in the tooltip. */
  readonly estimateFrom?: MonthKey | null
}

/** A rate change has no amount, so its ring keeps one size. */
const RATE_MARK = 10

/**
 * The month-end balance as a line in the loan's direction colour, solid up to the month on the day, and
 * brass and dashed after it, where the figures are the plan's. The two lines share the month on the day,
 * so they join. A dashed rule marks today, with a dot on today's balance. Each month's moves are a dot on
 * its balance, sized by their amount: a filled dot for what lowers what is owed and a ring for what raises
 * it, and a violet ring for a new rate. The tooltip names the moves of the nearest dot. The axis names
 * years, not months.
 */
export function balanceChart(months: readonly MonthBalance[], current: MonthKey, tokens: ChartTokens, phone: boolean, marks: BalanceMarks): BalanceChart {
  const categories: string[] = months.map((entry) => entry.month)
  const hasPlan = months.some((entry) => entry.month > current)
  const past = tokenColour(marks.token)
  const ahead = tokenColour('--loan-ahead')
  const rateColour = tokenColour('--loan-interest')
  const first = months[0]
  const last = months.at(-1)
  const now = months.find((entry) => entry.month === current) ?? last
  const line = (name: string, colour: string, shown: (month: MonthKey) => boolean, dashed: boolean, wash: number): LineSeries => ({
    type: 'line',
    name,
    color: colour,
    showSymbol: false,
    lineStyle: { width: 2, ...(dashed ? { type: [5, 4] } : {}) },
    areaStyle: { color: colour, opacity: wash },
    data: months.map((entry) => (shown(entry.month) ? entry.owed : null)),
  })
  const owedSoFar: LineSeries = {
    ...line(words.owedSoFar, past, (month) => month <= current, false, 0.1),
    markLine: {
      silent: true,
      symbol: 'none',
      lineStyle: { color: tokens.axis, type: 'dashed', width: 1 },
      label: { formatter: words.today, position: 'end', color: tokens.inkSecondary, fontSize: 11 },
      data: now === undefined || now.month !== current ? [] : [{ xAxis: current }],
    },
    markPoint: {
      silent: true,
      symbol: 'circle',
      label: { show: false },
      data: now === undefined || now.month !== current ? [] : [{ name: '', coord: [current, now.owed], symbolSize: 8, itemStyle: { color: past, borderColor: tokens.surface, borderWidth: 2 } }],
    },
  }
  const estimateFrom = marks.estimateFrom ?? null
  const stillToCome: LineSeries = {
    ...line(words.stillToCome, ahead, (month) => month >= current, true, 0.08),
    // A mark area carries the note, since a mark line turns its label along the line.
    ...(phone || estimateFrom === null || last === undefined
      ? {}
      : {
          markLine: { silent: true, symbol: 'none', lineStyle: { color: tokens.axis, type: 'dotted', width: 1 }, label: { show: false }, data: [{ xAxis: estimateFrom }] },
          markArea: {
            silent: true,
            itemStyle: { color: 'transparent' },
            label: { formatter: words.variableFrom, position: 'insideBottomLeft', color: tokens.inkMuted, fontSize: 11 },
            data: [[{ xAxis: estimateFrom }, { xAxis: last.month }]],
          },
        }),
  }

  const placeOf = new Map(months.map((entry, place) => [entry.month, place]))
  const moves = [...(marks.moves ?? [])].filter((move) => placeOf.has(monthOf(move.date))).sort((earlier, later) => earlier.date.localeCompare(later.date))
  // A month's moves of one effect make one dot, sized by what they come to.
  const dotAmounts = new Map<string, Money>()
  for (const move of moves) {
    const key = `${move.effect} ${monthOf(move.date)}`
    dotAmounts.set(key, addMoney(dotAmounts.get(key) ?? ZERO, move.amount ?? ZERO))
  }
  const largest = [...dotAmounts.values()].reduce((most, amount) => (amount > most ? amount : most), ZERO)
  const effects = new Set(moves.map((move) => move.effect))
  const dots = (effect: BalanceMove['effect']): ScatterSeries[] => {
    if (!effects.has(effect)) return []
    return [
      {
        type: 'scatter',
        name: '',
        silent: true,
        symbol: 'circle',
        // A ring is hollow and drawn over the dots, so a payment and a new rate of one month both show.
        z: effect === 'lowers' ? 3 : 4,
        itemStyle: effect === 'lowers' ? { color: past, borderColor: tokens.surface, borderWidth: 1 } : { color: 'transparent', borderColor: effect === 'rate' ? rateColour : past, borderWidth: 2 },
        data: months.map((entry) => {
          const amount = dotAmounts.get(`${effect} ${entry.month}`)
          return amount === undefined ? '-' : { value: entry.owed, symbolSize: effect === 'rate' ? RATE_MARK : markSize(amount, largest) }
        }),
      },
    ]
  }
  const markWords = [...(effects.has('lowers') ? [words.lowersMark] : []), ...(effects.has('raises') ? [words.raisesMark] : []), ...(effects.has('rate') ? [words.rateMark] : [])]
  const moveLine = (move: BalanceMove): string =>
    [shortDayLabel(move.date), move.amount === null ? move.kind : words.moveAmount(move.kind, formatMoney(move.amount)), move.note].filter((part) => part !== '').join(' · ')
  const movedMonths = [...new Set(moves.map((move) => monthOf(move.date)))]
  const linesOf = nearestDotLines(
    categories,
    movedMonths.map((month) => ({
      place: placeOf.get(month)!,
      lines: namedFirst(
        moves.filter((move) => monthOf(move.date) === month),
        moveLine,
        (rest) => plural(words.moreMoves(rest.length, formatMoney(sumMoney(rest.map((move) => move.amount ?? ZERO)))), rest.length),
      ),
    })),
    dotReach(months.length, phone),
    (place) => monthAxisLabel('long')(categories[place]!),
  )

  return {
    option: {
      grid: { top: 24, right: 16 },
      tooltip: {
        trigger: 'axis',
        // A month with moves has a wider tooltip than its neighbours, and sliding it over from one of them carries it past a phone's edge.
        transitionDuration: 0,
        formatter: (points: unknown) =>
          axisTooltip({
            tokens,
            categoryLabel: monthAxisLabel('long'),
            formatAmount: (amount) => formatMoney(amount),
            footnotes: (month) => [...linesOf(month), ...(estimateFrom !== null && month >= estimateFrom ? [words.estimate] : [])],
          })(shownPoints(points)),
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLabel: monthAxisLabels(
          months.map((entry) => entry.month),
          tokens,
          phone,
        ),
      },
      yAxis: { type: 'value', axisLabel: moneyAxisLabel(tokens) },
      series: [owedSoFar, ...(hasPlan ? [stillToCome] : []), ...dots('lowers'), ...dots('raises'), ...dots('rate')],
    },
    description:
      first === undefined || last === undefined || now === undefined
        ? words.noMonths
        : words.description(monthLabel(first.month), monthLabel(last.month), monthLabel(now.month), formatMoney(now.owed)) +
          (hasPlan ? words.planDescription(formatMoney(last.owed), monthLabel(last.month)) : '') +
          (moves.length === 0 ? '' : plural(words.movesDescription(moves.length, listInWords(markWords)), moves.length)) +
          (effects.has('lowers') || effects.has('raises') ? words.sizedByAmount : ''),
    legend: [
      { label: words.owedSoFar, colour: `var(${marks.token})`, mark: 'line' },
      ...(hasPlan ? [{ label: words.stillToCome, colour: 'var(--loan-ahead)', mark: 'dashed' as const }] : []),
      ...(effects.has('lowers') ? [{ label: words.lowers, colour: `var(${marks.token})`, mark: 'dot' as const }] : []),
      ...(effects.has('raises') ? [{ label: words.raises, colour: `var(${marks.token})`, mark: 'ring' as const }] : []),
      ...(effects.has('rate') ? [{ label: words.rateChange, colour: 'var(--loan-interest)', mark: 'ring' as const }] : []),
    ],
  }
}
