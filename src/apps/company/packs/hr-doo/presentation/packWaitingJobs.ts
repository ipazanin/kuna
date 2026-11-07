import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../../shared/calendar/dayLabel'
import { monthInYear } from '../../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { plural } from '../../../../../shared/text/translation'
import type { WaitingJob } from '../../../overview/presentation/waitingForYou'
import { REVIEW_LINK } from '../../../transactions/presentation/transactionsLinks'
import { displayNamesOf } from '../../../workbook/domain/displayName'
import type { HrDooWorkbook } from '../domain/hrDooPart'
import { packWaiting } from '../domain/packWaiting'
import type { CorporateTaxWaiting, MissedPayroll } from '../domain/packWaiting'
import { words } from './words'

/** The Taxes tab of Year, at one of its cards. */
function taxesTab(card: string): RouteLocationRaw {
  return { path: '/company/year', query: { tab: 'taxes' }, hash: `#${card}` }
}

/** What waits in the pack's books, said in a line each with the page and tab that does it. */
export function packWaitingJobs(workbook: HrDooWorkbook, asOf: CivilDate): WaitingJob[] {
  const { unaccounted, payroll, corporateTax } = packWaiting(workbook, asOf)
  return [unaccountedJob(unaccounted), payroll === null ? null : payrollJob(payroll, workbook, asOf), corporateTax === null ? null : corporateTaxJob(corporateTax)].flatMap((job) =>
    job === null ? [] : [job],
  )
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
