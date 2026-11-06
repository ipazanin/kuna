import type { MonthBalance } from '../domain/monthBalance'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthAxisLabel, monthLabel } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyAxisLabel } from '../../../../shared/charts/chartTheme'
import { DOT_SIZE, RING_SIZE, dotLinesAt, dotOffset, namedFirst } from '../../../../shared/charts/chartDots'
import { monthAxisLabels, shownPoints } from '../../../../shared/charts/monthAxis'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import { axisTooltip } from '../../../../shared/charts/chartTooltip'
import type { ChartOption, LineSeries, ScatterSeries } from '../../../../shared/charts/echarts'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

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
  /** Whether it draws a bank loan's plan still to come, which only months after the current one hold. */
  readonly drawsPlan: boolean
}

export interface BalanceMarks {
  /** The colour token of what is owed so far, the loan's direction. */
  readonly token: string
  /** Every move to mark, in any order. A move outside the chart's months is left out. */
  readonly moves?: readonly BalanceMove[]
  /** The first month the plan works out at a variable rate. A wide screen marks it on the chart while the chart shows that month, and every width notes it in the tooltip. */
  readonly estimateFrom?: MonthKey | null
  /**
   * What an informal loan's expected plan has it owe at each month end, empty for a loan without one. It is
   * drawn in place of the months after today, which on an informal loan are only movements dated ahead and
   * keep their dots. A bank loan leaves it out, since its months after today are its plan. It is the whole
   * line, whatever months the chart shows: the chart draws the months it shows and names the month the plan
   * owes nothing from the whole line.
   */
  readonly expected?: readonly MonthBalance[]
}

/**
 * The month-end balance as a line in the loan's direction colour, solid up to the month on the day, and
 * brass and dashed after it, where the figures are the plan's. The two lines share the month on the day,
 * so they join. An informal loan's expected plan is instead one brass dashed line with no wash, over every
 * month it covers. A dashed rule marks today, with a dot on today's balance unless a move of this month already
 * has its dot there. Each month's moves are a dot on
 * its balance, one size whatever their amount: one colour for what lowers what is owed and another for what
 * raises it, side by side in a month with both, and a violet ring for a new rate. The tooltip names the moves
 * of the month's dots. The axis names years, not months.
 */
export function balanceChart(months: readonly MonthBalance[], current: MonthKey, tokens: ChartTokens, phone: boolean, marks: BalanceMarks): BalanceChart {
  const categories: string[] = months.map((entry) => entry.month)
  const expected = marks.expected ?? null
  const hasPlan = expected === null && months.some((entry) => entry.month > current)
  const past = tokenColour(marks.token)
  const ahead = tokenColour('--loan-ahead')
  const first = months[0]
  const last = months.at(-1)
  const now = months.find((entry) => entry.month === current) ?? last
  const line = (name: string, colour: string, data: readonly (Money | null)[], dashed: boolean, wash: number | null): LineSeries => ({
    type: 'line',
    name,
    color: colour,
    showSymbol: false,
    lineStyle: { width: 2, ...(dashed ? { type: [5, 4] } : {}) },
    ...(wash === null ? {} : { areaStyle: { color: colour, opacity: wash } }),
    data: [...data],
  })
  // Today's dot would sit on this month's dot of a payment or of more borrowing and hide it.
  const movedNow = (marks.moves ?? []).some((move) => move.effect !== 'rate' && monthOf(move.date) === current)
  const owedWhere = (shown: (month: MonthKey) => boolean): (Money | null)[] => months.map((entry) => (shown(entry.month) ? entry.owed : null))
  const owedSoFar: LineSeries = {
    ...line(
      words.owedSoFar,
      past,
      owedWhere((month) => month <= current),
      false,
      0.1,
    ),
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
      data:
        now === undefined || now.month !== current || movedNow
          ? []
          : [{ name: '', coord: [current, now.owed], symbolSize: 8, itemStyle: { color: past, borderColor: tokens.surface, borderWidth: 2 } }],
    },
  }
  const estimateFrom = marks.estimateFrom ?? null
  const stillToCome: LineSeries = {
    ...line(
      words.stillToCome,
      ahead,
      owedWhere((month) => month >= current),
      true,
      0.08,
    ),
    // A mark area carries the note, since a mark line turns its label along the line.
    ...(phone || estimateFrom === null || last === undefined || !categories.includes(estimateFrom)
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
  const plannedBy = new Map((expected ?? []).map((entry) => [entry.month, entry.owed]))
  const planned = months.flatMap((entry) => {
    const owed = plannedBy.get(entry.month)
    return owed === undefined ? [] : [{ month: entry.month, owed }]
  })
  const expectedLine = line(
    words.expected,
    ahead,
    months.map((entry) => plannedBy.get(entry.month) ?? null),
    true,
    null,
  )

  const placeOf = new Map(months.map((entry, place) => [entry.month, place]))
  const moves = [...(marks.moves ?? [])].filter((move) => placeOf.has(monthOf(move.date))).sort((earlier, later) => earlier.date.localeCompare(later.date))
  // A month's moves of one effect make one dot.
  const marked = new Set(moves.map((move) => `${move.effect} ${monthOf(move.date)}`))
  const effects = new Set(moves.map((move) => move.effect))
  const dots = (effect: BalanceMove['effect']): ScatterSeries[] => {
    if (!effects.has(effect)) return []
    const ring = effect === 'rate'
    return [
      {
        type: 'scatter',
        name: '',
        silent: true,
        symbol: 'circle',
        symbolSize: ring ? RING_SIZE : DOT_SIZE,
        z: ring ? 4 : 3,
        itemStyle: ring
          ? { color: 'transparent', borderColor: tokenColour('--loan-interest'), borderWidth: 2 }
          : { color: tokenColour(effect === 'lowers' ? '--loan-lowers' : '--loan-raises'), borderColor: tokens.surface, borderWidth: 1 },
        data: months.map((entry) => {
          if (!marked.has(`${effect} ${entry.month}`)) return '-'
          const sideBySide = !ring && marked.has(`lowers ${entry.month}`) && marked.has(`raises ${entry.month}`)
          return { value: entry.owed, symbolOffset: dotOffset(sideBySide, effect === 'lowers') }
        }),
      },
    ]
  }
  const markWords = [...(effects.has('lowers') ? [words.lowersMark] : []), ...(effects.has('raises') ? [words.raisesMark] : []), ...(effects.has('rate') ? [words.rateMark] : [])]
  const moveLine = (move: BalanceMove): string =>
    [shortDayLabel(move.date), move.amount === null ? move.kind : words.moveAmount(move.kind, formatMoney(move.amount)), move.note].filter((part) => part !== '').join(' · ')
  const movedMonths = [...new Set(moves.map((move) => monthOf(move.date)))]
  const linesOf = dotLinesAt(
    categories,
    movedMonths.map((month) => ({
      place: placeOf.get(month)!,
      lines: namedFirst(
        moves.filter((move) => monthOf(move.date) === month),
        moveLine,
        (rest) => plural(words.moreMoves(rest.length, formatMoney(sumMoney(rest.map((move) => move.amount ?? ZERO)))), rest.length),
      ),
    })),
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
      series: [owedSoFar, ...(hasPlan ? [stillToCome] : []), ...(planned.length > 0 ? [expectedLine] : []), ...dots('lowers'), ...dots('raises'), ...dots('rate')],
    },
    description:
      first === undefined || last === undefined || now === undefined
        ? words.noMonths
        : words.description(monthLabel(first.month), monthLabel(last.month), monthLabel(now.month), formatMoney(now.owed)) +
          (hasPlan ? words.planDescription(formatMoney(last.owed), monthLabel(last.month)) : '') +
          expectedWords(planned, expected ?? [], current) +
          (moves.length === 0 ? '' : plural(words.movesDescription(moves.length, listInWords(markWords)), moves.length)) +
          (effects.has('lowers') || effects.has('raises') ? words.oneDotAMonth : ''),
    legend: [
      { label: words.owedSoFar, colour: `var(${marks.token})`, mark: 'line' },
      ...(hasPlan ? [{ label: words.stillToCome, colour: 'var(--loan-ahead)', mark: 'dashed' as const }] : []),
      ...(planned.length > 0 ? [{ label: words.expected, colour: 'var(--loan-ahead)', mark: 'dashed' as const }] : []),
      ...(effects.has('lowers') ? [{ label: words.lowers, colour: 'var(--loan-lowers)', mark: 'dot' as const }] : []),
      ...(effects.has('raises') ? [{ label: words.raises, colour: 'var(--loan-raises)', mark: 'dot' as const }] : []),
      ...(effects.has('rate') ? [{ label: words.rateChange, colour: 'var(--loan-interest)', mark: 'ring' as const }] : []),
    ],
    drawsPlan: hasPlan,
  }
}

/**
 * What the expected plan's line says: what it has owed at the end of the current month, and the month from which
 * it owes nothing, read from the whole line, or else what it still owes where the chart stops.
 */
function expectedWords(planned: readonly MonthBalance[], whole: readonly MonthBalance[], current: MonthKey): string {
  const last = planned.at(-1)
  if (last === undefined) return ''
  const now = planned.find((entry) => entry.month === current)
  // The plan owes nothing from the first month of the zeros its whole line ends on.
  const owingFromTheEnd = [...whole].reverse().findIndex((entry) => entry.owed > 0)
  const paidOff = (whole.at(-1)?.owed ?? 0) > 0 ? undefined : whole[owingFromTheEnd === -1 ? 0 : whole.length - owingFromTheEnd]
  return (
    (now === undefined ? '' : words.expectedDescription(formatMoney(now.owed), monthLabel(current))) +
    (paidOff === undefined ? words.expectedRunsOn(formatMoney(last.owed), monthLabel(last.month)) : words.expectedPaidOff(monthLabel(paidOff.month)))
  )
}
