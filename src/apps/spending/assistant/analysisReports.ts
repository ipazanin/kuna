import { spendingFigures } from '../analytics/domain/spendingFigures'
import { yearChange } from '../analytics/domain/yearAgainstYear'
import { categoryTree } from '../categories/domain/categoryTree'
import type { Category } from '../workbook/domain/category'
import type { SpendingBook } from '../workbook/domain/readSpendingBook'
import type { ReportFigure } from '../../../shared/app/assistantReader'
import { lastDayOf, monthOf, parseMonthKey, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { today } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { EURO } from '../../../shared/money/currencyCode'
import type { Money } from '../../../shared/money/money'
import { nearestBasisPoints, pointsOfShare } from '../../../shared/money/percent'
import type { RateBook } from '../../../shared/money/rateBook'

function monthNamed(period: string | null): MonthKey {
  if (period === null) return monthOf(today())
  const month = parseMonthKey(period)
  if (month === null) throw new RangeError('Not a month.')
  return month
}

/** The month's last day, or today while the month is still going, which is the day Analysis reads it on. */
function dayOfMonthRead(month: MonthKey): CivilDate {
  const now = today()
  return month >= monthOf(now) ? now : lastDayOf(month)
}

function euros(label: string, cents: Money): ReportFigure {
  return { label, of: 'app', cents, currency: EURO }
}

/** What a month kept by Overview's savings rate and what it became, as Analysis' Savings and trends splits it. */
export function keptFigures(book: SpendingBook, rates: RateBook, month: MonthKey): readonly ReportFigure[] {
  const [kept] = spendingFigures(book, rates).keptIn([month])
  if (kept === undefined) return []
  return [
    euros('kept, income less spending', kept.kept),
    euros('kept: to investments', kept.investments),
    euros('kept: to bank loan principal', kept.loanPrincipal),
    euros('kept: to things bought', kept.assets),
    euros('kept: left in the accounts', kept.rest),
  ]
}

/** Each spending group and category that grows or shrinks over the whole months before the month, as Analysis lists them, and how many are steady. */
function trendsReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const month = monthNamed(period)
  const trends = spendingFigures(book, rates).trendsOn(dayOfMonthRead(month))
  if (trends.length === 0) return [{ label: 'whole months before the month: too few for a trend, which needs six', count: 0 }]
  const named = (category: Category): string => {
    const group = book.categories.find((held) => held.id === category.parent)
    return group === undefined ? category.name : `${group.name} / ${category.name}`
  }
  return [
    ...trends
      .filter((trend) => trend.trend !== 'steady')
      .flatMap(({ category, trend, recent, before, change, share }): readonly ReportFigure[] => [
        euros(`${named(category)} (${trend}): average month of the last 3`, recent),
        euros(`${named(category)} (${trend}): average month of the 12 before`, before),
        euros(`${named(category)} (${trend}): change a month`, change),
        ...(share === null ? [] : [{ label: `${named(category)} (${trend}): change`, basisPoints: nearestBasisPoints(pointsOfShare(share)) }]),
      ]),
    { label: 'steady categories', count: trends.filter((trend) => trend.trend === 'steady').length },
  ]
}

/** The month's year so far against the same days a year before, for all spending and each spending group, as Year against year shows them. */
function yearReport(book: SpendingBook, rates: RateBook, period: string | null): readonly ReportFigure[] {
  const month = monthNamed(period)
  const day = dayOfMonthRead(month)
  const year = yearOfMonth(month)
  const figures = spendingFigures(book, rates)
  const lines = (name: string, category: Category | null): readonly ReportFigure[] => {
    const against = figures.yearAgainstYearOf(category, year, day)
    if (against.toDate.counted === 0 && against.lastYearToDate.counted === 0) return []
    const { change } = yearChange(against)
    return [
      euros(`${name}: ${year} up to ${against.toDate.days.to}`, against.toDate.counted),
      euros(`${name}: ${year - 1} up to ${against.lastYearToDate.days.to}`, against.lastYearToDate.counted),
      euros(`${name}: change`, change),
    ]
  }
  return [
    ...lines('all spending', null),
    ...categoryTree(book.categories, ['spending']).flatMap(({ group }) => lines(group.name, group)),
    { label: 'rows left out because no exchange rate reaches them yet', count: figures.yearAgainstYearOf(null, year, day).toDate.unrated },
  ]
}

/** The reports Analysis adds to the chat, each read for a month. */
export const ANALYSIS_REPORTS = { trends: trendsReport, year: yearReport } as const
