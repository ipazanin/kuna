import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { firstDayOf, monthOf, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { sumMoney } from '../../../shared/money/money'
import { formatMoney } from '../../../shared/money/moneyFormat'
import { forecastYear } from '../../../packs/hr-doo/domain/forecast/forecastYear'
import { ownerAdvances } from '../../../packs/hr-doo/domain/ownerAdvances'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { planMonthLink } from '../../invoicing/presentation/invoicingLinks'
import { amountsOwed } from '../../receivables/domain/ageing'
import { receivablesOf } from '../../receivables/domain/invoiceMatching'
import { needsReview } from '../../workbook/domain/needsReview'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'

/** One job that has something to do, said in a line, with the page and tab that does it. */
export interface WaitingJob {
  readonly key: 'review' | 'unaccounted' | 'invoice' | 'overdue' | 'corporate-tax'
  readonly text: string
  /** `negative` for something already late, `warning` for something due. */
  readonly tone: 'warning' | 'negative'
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
}

const LONG_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const LONG_MONTH_AND_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`
}

/**
 * What waits for a person across the whole workbook, whatever the filters, seen on the newest
 * booking: rows to review, reimbursements with no cost on file, invoices the billing plan expects
 * by this month that are not made, invoices past their due date, and corporate tax due this month
 * or overdue. `bankRows` are the ledger rows as read, since a person reviews the row the bank
 * booked. The owner pay pack's jobs come only while its module is on.
 */
export function waitingJobs(workbook: Workbook, bankRows: readonly Transaction[]): WaitingJob[] {
  const asOf = newestBookingOf(workbook.transactions)
  if (asOf === null) {
    return []
  }
  const pack = workbook.settings.ownerPayModule
  return [
    reviewJob(bankRows),
    ...(pack ? [unaccountedJob(workbook)] : []),
    invoiceJob(workbook, asOf),
    overdueJob(workbook, asOf),
    ...(pack ? [corporateTaxJob(workbook, asOf)] : []),
  ].flatMap((job) => (job === null ? [] : [job]))
}

function reviewJob(bankRows: readonly Transaction[]): WaitingJob | null {
  const count = bankRows.filter(needsReview).length
  if (count === 0) return null
  return {
    key: 'review',
    text: `${count} ${count === 1 ? 'row waits' : 'rows wait'} for a category check`,
    tone: 'warning',
    link: { label: 'Review', to: '/review' },
  }
}

function unaccountedJob(workbook: Workbook): WaitingJob | null {
  const { unaccounted } = ownerAdvances(workbook.ownerAdvances, workbook.transactions, workbook.categories)
  if (unaccounted.length === 0) return null
  return {
    key: 'unaccounted',
    text: `${counted(unaccounted.length, 'A reimbursement to the owner has', 'reimbursements to the owner have')} no cost on file`,
    tone: 'warning',
    link: { label: 'Review', to: '/review' },
  }
}

function invoiceJob(workbook: Workbook, asOf: CivilDate): WaitingJob | null {
  const thisMonth = monthOf(asOf)
  const due = expectedInvoices(workbook.billingPlan, workbook.invoices).filter((expected) => expected.month <= thisMonth)
  const oldest = due[0]
  if (oldest === undefined) return null
  const clientName = (slug: string): string => workbook.clients.find((client) => client.slug === slug)?.name || slug
  const monthName = (month: MonthKey): string => (yearOfMonth(month) === yearOf(asOf) ? LONG_MONTH : LONG_MONTH_AND_YEAR).format(new Date(firstDayOf(month)))
  const text =
    due.length > 1
      ? `${due.length} invoices the billing plan expects are not made yet, the oldest for ${monthName(oldest.month)}`
      : oldest.month === thisMonth
        ? `This month's invoice for ${clientName(oldest.client)} is not made yet`
        : `The ${monthName(oldest.month)} invoice for ${clientName(oldest.client)} is not made yet`
  return {
    key: 'invoice',
    text,
    tone: oldest.month < thisMonth ? 'negative' : 'warning',
    link: { label: 'Invoicing', to: planMonthLink(oldest.month) },
  }
}

function overdueJob(workbook: Workbook, asOf: CivilDate): WaitingJob | null {
  const invoices = receivablesOf(workbook.transactions, workbook.categories, workbook.invoices, workbook.clients).clients.flatMap((entry) => entry.invoices)
  const { overdue, overdueCount } = amountsOwed(invoices, asOf)
  if (overdueCount === 0) return null
  return {
    key: 'overdue',
    text: `${counted(overdueCount, 'An invoice is', 'invoices are')} past the due date, ${formatMoney(overdue)} still owed`,
    tone: 'negative',
    link: { label: 'Invoices', to: '/invoicing' },
  }
}

/** Without the registration day there is no tax schedule to hold the payments against, so nothing is said. */
function corporateTaxJob(workbook: Workbook, asOf: CivilDate): WaitingJob | null {
  if (workbook.settings.companyFacts.companyRegistered === null) return null
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
      ? `${counted(overdue.length, 'A corporate tax payment is', 'corporate tax payments are')} overdue, ${owed(overdue)} still owed`
      : next === undefined
        ? null
        : `${counted(due.length, 'A corporate tax payment falls', 'corporate tax payments fall')} due by ${DAY.format(new Date(next.obligation.dueOn))}, ${owed(due)}`
  return text === null ? null : { key: 'corporate-tax', text, tone: overdue.length > 0 ? 'negative' : 'warning', link: { label: 'Taxes', to: '/taxes' } }
}
