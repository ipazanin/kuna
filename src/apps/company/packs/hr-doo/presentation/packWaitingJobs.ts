import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../../shared/calendar/dayLabel'
import { monthInYear } from '../../../../../shared/calendar/monthLabel'
import { sumMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { plural } from '../../../../../shared/text/translation'
import type { WaitingJob } from '../../../overview/presentation/waitingForYou'
import { displayNamesOf } from '../../../workbook/domain/displayName'
import { bookingOfAdvance, ledgerWindowOf } from '../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../domain/hrDooPart'
import { forecastYear } from '../domain/forecast/forecastYear'
import { ownerAdvances } from '../domain/ownerAdvances'
import { payrollCadence } from '../domain/payrollCadence'
import { words } from './words'

/** The Taxes tab of Year, at one of its cards. */
function taxesTab(card: string): RouteLocationRaw {
  return { path: '/company/year', query: { tab: 'taxes' }, hash: `#${card}` }
}

/** Reimbursements with no cost on file, a payroll month with no payment, and corporate tax due this month or overdue. */
export function packWaitingJobs(workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob[] {
  return [unaccountedJob(workbook), payrollJob(workbook, asOf), corporateTaxJob(workbook, asOf)].flatMap((job) => (job === null ? [] : [job]))
}

function unaccountedJob(workbook: HrDooWorkbook): WaitingJob | null {
  const { unaccounted } = ownerAdvances(workbook.ownerAdvances, workbook.transactions, workbook.categories)
  if (unaccounted.length === 0) return null
  return {
    key: 'unaccounted',
    text: plural(words.waiting.unaccounted(unaccounted.length), unaccounted.length),
    tone: 'warning',
    link: { label: words.links.review, to: '/company/review' },
  }
}

/**
 * A complete month in which a watched tax, such as the payroll contributions, had no payment. The
 * owner's advances count, as on the payroll cadence.
 */
function payrollJob(workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob | null {
  const window = ledgerWindowOf(workbook.transactions)
  if (window === null) return null
  const bookings = [...workbook.transactions, ...workbook.ownerAdvances.map(bookingOfAdvance)]
  const missed = payrollCadence(bookings, workbook.categories, window).flatMap((cadence) =>
    cadence.months.filter((month) => month.state === 'missing').map((month) => ({ category: cadence.category, month: month.month })),
  )
  const latest = missed.reduce<(typeof missed)[number] | null>((found, entry) => (found === null || entry.month > found.month ? entry : found), null)
  if (latest === null) return null
  const categories = new Set(missed.map((entry) => entry.category))
  const name = displayNamesOf(workbook).category(latest.category)
  const latestMonth = monthInYear(latest.month, yearOf(asOf))
  const text =
    categories.size > 1
      ? plural(words.waiting.watchedTaxesMissed(missed.length, latestMonth), missed.length)
      : missed.length === 1
        ? words.waiting.missedOnce(name, latestMonth)
        : plural(words.waiting.missedMonths(name, missed.length, latestMonth), missed.length)
  return { key: 'payroll', text, tone: 'negative', link: { label: words.links.yearTaxes, to: taxesTab('payroll-cadence') } }
}

/** Without the registration day there is no tax schedule to hold the payments against, so nothing is said. */
function corporateTaxJob(workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob | null {
  if (workbook.companyFacts.companyRegistered === null) return null
  let history
  try {
    history = forecastYear(workbook, yearOf(asOf), asOf).cit.history
  } catch (failure) {
    if (failure instanceof RangeError) return null
    throw failure
  }
  const overdue = history.filter((entry) => entry.status === 'overdue')
  const due = history.filter((entry) => entry.status === 'due')
  const owed = (entries: typeof history): string => formatMoney(sumMoney(entries.map((entry) => entry.outstanding)))
  const next = due[0]
  const text =
    overdue.length > 0
      ? plural(words.waiting.taxOverdue(overdue.length, owed(overdue)), overdue.length)
      : next === undefined
        ? null
        : plural(words.waiting.taxDue(due.length, shortDayLabel(next.obligation.dueOn), owed(due)), due.length)
  return text === null ? null : { key: 'corporate-tax', text, tone: overdue.length > 0 ? 'negative' : 'warning', link: { label: words.links.yearTaxes, to: taxesTab('corporate-tax') } }
}
