import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../../shared/calendar/dayLabel'
import { monthInYear } from '../../../../../shared/calendar/monthLabel'
import { negateMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { plural } from '../../../../../shared/text/translation'
import type { WaitingJob } from '../../../overview/presentation/waitingForYou'
import { REVIEW_LINK } from '../../../transactions/presentation/transactionsLinks'
import { displayNamesOf } from '../../../workbook/domain/displayName'
import type { HrDooWorkbook } from '../domain/hrDooPart'
import { packWaiting } from '../domain/packWaiting'
import type { CorporateTaxWaiting, MissedPayroll } from '../domain/packWaiting'
import type { Trip } from '../domain/trips/trip'
import { tripsWaiting } from '../domain/trips/tripPayments'
import { waitsForSettlement } from '../domain/trips/tripSettlement'
import type { RateBook } from '../../../../../shared/money/rateBook'
import { ruleValue } from '../ruleset/ruleset'
import { employeeName } from './salaries/salariesView'
import { SETTLEMENT_TAB, tripLink } from './trips/tripLinks'
import { words } from './words'

/** The Taxes tab of Year, at one of its cards. */
function taxesTab(card: string): RouteLocationRaw {
  return { path: '/company/year', query: { tab: 'taxes' }, hash: `#${card}` }
}

/** What waits in the pack's books, said in a line each with the page and tab that does it. */
export function packWaitingJobs(workbook: HrDooWorkbook, asOf: CivilDate, rates: RateBook): WaitingJob[] {
  const { unaccounted, payroll, corporateTax } = packWaiting(workbook, asOf)
  const core = [unaccountedJob(unaccounted), payroll === null ? null : payrollJob(payroll, workbook, asOf), corporateTax === null ? null : corporateTaxJob(corporateTax)].flatMap((job) =>
    job === null ? [] : [job],
  )
  const trips = workbook.trips.map((file) => file.trip).filter((trip) => waitsForSettlement(trip, asOf))
  const { toLink, reports } = tripsWaiting(workbook.trips, workbook.employees, workbook.transactions, asOf, ruleValue, rates)
  const nameOf = (slug: string) => {
    const traveller = workbook.employees.find((employee) => employee.slug === slug)
    return traveller === undefined ? slug : employeeName(traveller)
  }
  return [
    ...core,
    ...trips.map((trip) => tripJob(trip, workbook, asOf)),
    ...toLink.map(({ trip, link, row }): WaitingJob => ({
      key: `trip-${link}-${trip.number}`,
      text: words.waiting.tripRowToLink[link](trip.number, nameOf(trip.traveller), formatMoney(negateMoney(row.amount)), dayLabel(row.date)),
      tone: 'info',
      link: { label: words.links.tripSettlement, to: tripLink(trip.id, SETTLEMENT_TAB) },
    })),
    ...reports.flatMap(({ report, late }): WaitingJob[] =>
      report.amount === null
        ? []
        : [
            {
              key: `trip-joppd-${report.trip.number}`,
              text: (late ? words.waiting.tripReportLate : words.waiting.tripReportDue)(report.trip.number, nameOf(report.trip.traveller), formatMoney(report.amount), dayLabel(report.dueOn)),
              tone: late ? 'negative' : 'info',
              link: { label: words.links.salaries, to: { path: '/company/salaries', query: { year: report.month.slice(0, 4), month: report.month } } },
            },
          ],
    ),
  ]
}

/** A travel order whose traveller is back and which is not settled yet, with its settle-by day, late once that day has passed. */
function tripJob(trip: Trip, workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob {
  const traveller = workbook.employees.find((employee) => employee.slug === trip.traveller)
  const name = traveller === undefined ? trip.traveller : employeeName(traveller)
  const { settleBy } = trip
  const late = settleBy !== null && settleBy < asOf
  const text =
    settleBy === null
      ? words.waiting.tripToSettle(trip.number, name, trip.destination)
      : (late ? words.waiting.tripLate : words.waiting.tripDue)(trip.number, name, trip.destination, dayLabel(settleBy))
  return {
    key: `trip-${trip.number}`,
    text,
    tone: late ? 'negative' : 'warning',
    link: { label: words.links.tripSettlement, to: tripLink(trip.id, SETTLEMENT_TAB) },
  }
}

function unaccountedJob(unaccounted: number): WaitingJob | null {
  if (unaccounted === 0) return null
  return {
    key: 'unaccounted',
    text: plural(words.waiting.unaccounted(unaccounted), unaccounted),
    tone: 'warning',
    link: { label: words.links.review, to: REVIEW_LINK },
  }
}

function payrollJob(missed: MissedPayroll, workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob {
  const name = displayNamesOf(workbook).category(missed.latestCategory)
  const latestMonth = monthInYear(missed.latestMonth, yearOf(asOf))
  const text =
    missed.watchedTaxes > 1
      ? plural(words.waiting.watchedTaxesMissed(missed.months, latestMonth), missed.months)
      : missed.months === 1
        ? words.waiting.missedOnce(name, latestMonth)
        : plural(words.waiting.missedMonths(name, missed.months, latestMonth), missed.months)
  return { key: 'payroll', text, tone: 'negative', link: { label: words.links.yearTaxes, to: taxesTab('payroll-cadence') } }
}

function corporateTaxJob(waiting: CorporateTaxWaiting): WaitingJob {
  const overdue = waiting.kind === 'overdue'
  const text = overdue
    ? plural(words.waiting.taxOverdue(waiting.payments, formatMoney(waiting.owed)), waiting.payments)
    : plural(words.waiting.taxDue(waiting.payments, shortDayLabel(waiting.nextDueOn), formatMoney(waiting.owed)), waiting.payments)
  return { key: 'corporate-tax', text, tone: overdue ? 'negative' : 'warning', link: { label: words.links.yearTaxes, to: taxesTab('corporate-tax') } }
}
