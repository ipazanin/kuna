import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { firstDayOf, monthOf, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { formatMoney } from '../../../shared/money/moneyFormat'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { planMonthLink } from '../../invoicing/presentation/invoicingLinks'
import { amountsOwed } from '../../receivables/domain/ageing'
import { receivablesOf } from '../../receivables/domain/invoiceMatching'
import { shownPack } from '../../packs/packContribution'
import { needsReview } from '../../workbook/domain/needsReview'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'

/** One job that has something to do, said in a line, with the page and tab that does it. */
export interface WaitingJob {
  /** Names the job, such as `review`. */
  readonly key: string
  readonly text: string
  /** `negative` for something already late, `warning` for something due. */
  readonly tone: 'warning' | 'negative'
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
}

const LONG_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const LONG_MONTH_AND_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The singular wording for one, or the count with the plural wording. */
export function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`
}

/** "September" in the year of the newest booking, "September 2025" before it. */
export function monthName(month: MonthKey, asOf: CivilDate): string {
  return (yearOfMonth(month) === yearOf(asOf) ? LONG_MONTH : LONG_MONTH_AND_YEAR).format(new Date(firstDayOf(month)))
}

/**
 * What waits for a person across the whole workbook, whatever the filters, seen on the newest
 * booking: rows to review, invoices the billing plan expects by this month that are not made and
 * invoices past their due date, then the pack's jobs while its module is on. `bankRows` are the
 * ledger rows as read, since a person reviews the row the bank booked.
 */
export function waitingJobs(workbook: Workbook, bankRows: readonly Transaction[]): WaitingJob[] {
  const asOf = newestBookingOf(workbook.transactions)
  if (asOf === null) {
    return []
  }
  const core = [reviewJob(bankRows), invoiceJob(workbook, asOf), overdueJob(workbook, asOf)].flatMap((job) => (job === null ? [] : [job]))
  return [...core, ...shownPack(workbook.settings).waitingJobs(workbook, asOf)]
}

/** The statements the last sync held, or why it could not read the folder, with the Import tab that shows them. */
export function statementsJob(notFiled: number, problem: string | null): WaitingJob | null {
  if (notFiled === 0 && problem === null) return null
  return {
    key: 'statements',
    text: notFiled > 0 ? `${counted(notFiled, '1 statement was', 'statements were')} not filed` : 'The statements folder could not be read',
    tone: 'warning',
    link: { label: 'Import', to: { path: '/transactions', query: { tab: 'import' } } },
  }
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

function invoiceJob(workbook: Workbook, asOf: CivilDate): WaitingJob | null {
  const thisMonth = monthOf(asOf)
  const due = expectedInvoices(workbook.billingPlan, workbook.invoices).filter((expected) => expected.month <= thisMonth)
  const oldest = due[0]
  if (oldest === undefined) return null
  const clientName = (slug: string): string => workbook.clients.find((client) => client.slug === slug)?.name || slug
  const text =
    due.length > 1
      ? `${due.length} invoices the billing plan expects are not made yet, the oldest for ${monthName(oldest.month, asOf)}`
      : oldest.month === thisMonth
        ? `This month's invoice for ${clientName(oldest.client)} is not made yet`
        : `The ${monthName(oldest.month, asOf)} invoice for ${clientName(oldest.client)} is not made yet`
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
