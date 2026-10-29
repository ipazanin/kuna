import type { Category } from '../../../../workbook/domain/workbook'
import { addMonths, monthCountBetween } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import type { MonthSpan } from '../../../../../../shared/calendar/ledgerWindow'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { ZERO, divideMoney } from '../../../../../../shared/money/money'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import type { CostLine } from '../accrual/costLines'
import { deducted, summed, tracedFigure } from '../payroll/payrollArithmetic'

/**
 * What a month's figure rests on: the ledger, a plan row, the trailing average, a cost paid ahead
 * whose spread reaches the month, or the asset and grant engines.
 */
export type MonthBasis = 'actual' | 'planned' | 'averaged' | 'paid-ahead' | 'scheduled'

export interface ForecastMonth {
  readonly month: MonthKey
  /** One basis on a line of its own, several on a line that adds up lines that differ, none where nothing feeds the month. */
  readonly bases: readonly MonthBasis[]
  /** What the forecast counts for the month. */
  readonly figure: TracedFigure
  /** In the running month only: what the ledger holds for it so far, shown and never counted. */
  readonly soFar: TracedFigure | null
  /** In a month the ledger settles, what the plan had for it, kept to compare with. Null otherwise. */
  readonly plan: TracedFigure | null
}

export interface ForecastLine {
  readonly label: string
  /** January to December. */
  readonly months: readonly ForecastMonth[]
  readonly total: TracedFigure
  /** The months its average was taken over, or null when no month of the line is averaged. */
  readonly averagedOver: MonthSpan | null
  /** What a later month with no plan row takes, whether or not one does. Null on a line the engines or other lines fill. */
  readonly average: TracedFigure | null
}

/** The profit and loss lines the forecast fills, by the year-end tab's line ids. */
export type ForecastPlLineId = 'sales' | 'other-operating-income' | CostLine

export interface ForecastPlLine {
  readonly line: ForecastPlLineId
  /** Income and costs both read positive, as the statements print them. */
  readonly forecast: ForecastLine
  /** The categories and engine lines it adds up, each signed so that they sum to it. */
  readonly parts: readonly LinePart[]
}

/** One category the accrual view counts in profit, other than client revenue. */
export interface CategoryForecast {
  readonly category: Category
  readonly line: Exclude<ForecastPlLineId, 'sales'>
  /** Signed as booked, so a cost is negative. */
  readonly forecast: ForecastLine
}

/** Where a year stands against the ledger on the day of the forecast. */
export interface ForecastCalendar {
  /** January to December of the year. */
  readonly months: readonly MonthKey[]
  /** The first month the ledger covers from its first day. Null while it holds no row. */
  readonly firstComplete: MonthKey | null
  /** The last month the ledger covers in full. Null while it holds no row. */
  readonly lastComplete: MonthKey | null
  /** The month of the newest booking, which is still filling up. Null while the ledger holds no row. */
  readonly running: MonthKey | null
}

/** How one line fills its months. */
export interface LineSources {
  readonly label: string
  readonly basis: FigureBasis
  /** The line's last month the ledger settles, or null when it settles none. Later months are planned, paid ahead or averaged. */
  readonly lastActual: MonthKey | null
  readonly actual: (month: MonthKey) => TracedFigure
  readonly planned: (month: MonthKey) => TracedFigure | null
  readonly paidAhead: (month: MonthKey) => TracedFigure | null
  /** What a month the ledger settles is compared with. `planned` when left out. */
  readonly comparison?: (month: MonthKey) => TracedFigure | null
  /** How many actual months the average reaches back, `AVERAGED_MONTHS` when left out. */
  readonly averagedMonths?: number
}

/** How many complete months a trailing average reaches back. */
export const AVERAGED_MONTHS = 12

/** A cost paid in arrears, such as pay and rent, carries its last actual month forward instead. */
export const ARREARS_AVERAGED_MONTHS = 1

/**
 * A line of the year: the ledger's figure up to its last actual month, then for each later month a
 * plan row, else what a cost paid ahead already covers, else the average of its last twelve
 * actual months, or of fewer where the sources say so. The ledger's first part month never counts
 * in the average. A month the ledger settles keeps what the plan had for it, to compare with.
 */
export function forecastLine(calendar: ForecastCalendar, sources: LineSources): ForecastLine {
  const span = averageSpan(calendar.firstComplete, sources.lastActual, sources.averagedMonths ?? AVERAGED_MONTHS)
  const average = averageOf(sources, span)
  const comparison = sources.comparison ?? sources.planned
  const months = calendar.months.map((month): ForecastMonth => {
    if (sources.lastActual !== null && month <= sources.lastActual) {
      return { month, bases: ['actual'], figure: sources.actual(month), soFar: null, plan: comparison(month) }
    }
    const soFar = month === calendar.running ? sources.actual(month) : null
    const planned = sources.planned(month)
    if (planned !== null) {
      return { month, bases: ['planned'], figure: planned, soFar, plan: null }
    }
    const paidAhead = sources.paidAhead(month)
    if (paidAhead !== null) {
      return { month, bases: ['paid-ahead'], figure: paidAhead, soFar, plan: null }
    }
    return { month, bases: ['averaged'], figure: tracedFigure(`${sources.label}, ${monthLabel(month)}: averaged`, average.amount, sources.basis, average.rules, [average]), soFar, plan: null }
  })
  const averaged = months.some((entry) => entry.bases.includes('averaged'))
  return {
    label: sources.label,
    months,
    total: summed(
      sources.label,
      months.map((entry) => entry.figure),
      sources.basis,
    ),
    averagedOver: averaged ? span : null,
    average,
  }
}

/** A line the asset and grant engines give for every month of the year. */
export function scheduledLine(calendar: ForecastCalendar, label: string, monthFigure: (month: MonthKey) => TracedFigure): ForecastLine {
  const months = calendar.months.map((month): ForecastMonth => ({ month, bases: ['scheduled'], figure: monthFigure(month), soFar: null, plan: null }))
  return {
    label,
    months,
    total: summed(
      label,
      months.map((entry) => entry.figure),
      'assets',
    ),
    averagedOver: null,
    average: null,
  }
}

/** One line counted into another, added or taken away. */
export interface LinePart {
  readonly line: ForecastLine
  readonly sign: 1 | -1
}

/** A line that adds up others month by month, such as a profit and loss line over its categories. */
export function addedUpLine(calendar: ForecastCalendar, label: string, parts: readonly LinePart[]): ForecastLine {
  const signed = (figure: TracedFigure, sign: 1 | -1) => (sign === 1 ? figure : deducted(figure))
  const months = calendar.months.map((month, index): ForecastMonth => {
    const inMonth = parts.map((part) => ({ part, entry: part.line.months[index] as ForecastMonth }))
    const shown = inMonth.filter(({ entry }) => entry.soFar !== null)
    return {
      month,
      bases: [...new Set(inMonth.flatMap(({ entry }) => entry.bases))],
      figure: summed(
        `${label}, ${monthLabel(month)}`,
        inMonth.map(({ part, entry }) => signed(entry.figure, part.sign)),
        'ledger',
      ),
      soFar:
        shown.length === 0
          ? null
          : summed(
              `${label}, ${monthLabel(month)} so far`,
              shown.map(({ part, entry }) => signed(entry.soFar as TracedFigure, part.sign)),
              'ledger',
            ),
      plan: null,
    }
  })
  return {
    label,
    months,
    total: summed(
      label,
      parts.map((part) => signed(part.line.total, part.sign)),
      'ledger',
    ),
    averagedOver: null,
    average: null,
  }
}

/** A line's figure for one month of its year. */
export function monthOfLine(line: ForecastLine, month: MonthKey): ForecastMonth {
  const found = line.months.find((entry) => entry.month === month)
  if (found === undefined) {
    throw new RangeError(`${line.label} has no month ${month}.`)
  }
  return found
}

function averageSpan(firstComplete: MonthKey | null, lastActual: MonthKey | null, monthCount: number): MonthSpan | null {
  if (firstComplete === null || lastActual === null || lastActual < firstComplete) {
    return null
  }
  const earliest = addMonths(lastActual, 1 - monthCount)
  const from = earliest > firstComplete ? earliest : firstComplete
  return { from, to: lastActual, monthCount: monthCountBetween(from, lastActual) }
}

function averageOf(sources: LineSources, span: MonthSpan | null): TracedFigure {
  if (span === null) {
    return tracedFigure('No complete month to average, so nothing', ZERO, sources.basis, [])
  }
  const months = Array.from({ length: span.monthCount }, (_, offset) => sources.actual(addMonths(span.from, offset)))
  const total = summed(`${sources.label}, ${monthLabel(span.from)} to ${monthLabel(span.to)}`, months, sources.basis)
  if (span.monthCount === 1) {
    return { ...total, label: `As in ${monthLabel(span.from)}, the last month the ledger settles` }
  }
  return tracedFigure(`Average of the ${span.monthCount} months from ${monthLabel(span.from)} to ${monthLabel(span.to)}`, divideMoney(total.amount, span.monthCount), sources.basis, total.rules, [
    total,
  ])
}
