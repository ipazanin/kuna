import type { ChartTokens } from './chartTokens'
import { yearStep } from './monthAxis'
import { parseCivilDate } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { dayLabel } from '../calendar/dayLabel'
import { lastDayOf, monthCountBetween, monthOf, yearOfMonth } from '../calendar/monthKey'
import { shortMonthLabel } from '../calendar/monthLabel'

/** Up to this many months an axis labels its month ends, and beyond it its years. */
const MONTHS_ON_A_SHORT_AXIS = 13

/** The most month ends a short axis labels, so that a Croatian month such as `velj 25.` keeps clear of the next. */
const MONTH_LABELS = { phone: 4, wider: 7 }

/** Month steps that divide a year, so the labelled months fall on the same calendar months every year. */
const MONTH_STEPS = [1, 2, 3, 4, 6, 12]

/** A day the axis holds as `yyyy-mm-dd`, as a reader writes it. */
export function dayOfCategory(category: string): string {
  const day = parseCivilDate(category)
  return day === null ? category : dayLabel(day)
}

/**
 * The labels of an axis of days: on a short one its month ends, thinned to calendar months a few apart so they fit, and on
 * a long one each January's month end of every year step, as the month axes have it. On an axis of closes a month ends on
 * its last close, since a month's last day may have none.
 */
export function dayAxisLabels(dates: readonly CivilDate[], tokens: ChartTokens, phone: boolean): Record<string, unknown> {
  const first = dates[0]
  const last = dates.at(-1)
  const isMonthEnd = (category: string, index: number): boolean => {
    const day = parseCivilDate(category)
    if (index === 0 || day === null) return false
    const next = dates[index + 1]
    return day === lastDayOf(monthOf(day)) || (next !== undefined && monthOf(next) !== monthOf(day))
  }
  const monthNumber = (category: string): number => Number(category.slice(5, 7))
  if (first === undefined || last === undefined || monthCountBetween(monthOf(first), monthOf(last)) <= MONTHS_ON_A_SHORT_AXIS) {
    const monthEnds = dates.filter((day, index) => isMonthEnd(day, index)).map(monthNumber)
    const most = phone ? MONTH_LABELS.phone : MONTH_LABELS.wider
    const step = MONTH_STEPS.find((months) => monthEnds.filter((month) => month % months === 0).length <= most) ?? 12
    return {
      color: tokens.inkMuted,
      hideOverlap: true,
      interval: (index: number, category: string) => isMonthEnd(category, index) && monthNumber(category) % step === 0,
      formatter: (category: string) => shortMonthLabel(monthOf(parseCivilDate(category) ?? first)),
    }
  }
  const step = yearStep(yearOfMonth(monthOf(last)) - yearOfMonth(monthOf(first)), phone)
  return {
    color: tokens.inkMuted,
    interval: (index: number, category: string) => isMonthEnd(category, index) && monthNumber(category) === 1 && Number(category.slice(0, 4)) % step === 0,
    formatter: (category: string) => category.slice(0, 4),
  }
}
