import type { RouteLocationRaw } from 'vue-router'

import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthInYear } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { planMonthLink } from '../../invoicing/presentation/invoicingLinks'
import { amountsOwed } from '../../receivables/domain/ageing'
import { receivablesOf } from '../../receivables/domain/invoiceMatching'
import { shownPack } from '../../packs/packContribution'
import { needsReview } from '../../workbook/domain/needsReview'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { Transaction, Workbook } from '../../workbook/domain/workbook'
import { words } from './words'

/** One job that has something to do, said in a line, with the page and tab that does it. */
export interface WaitingJob {
  /** Names the job, such as `review`. */
  readonly key: string
  readonly text: string
  /** `negative` for something already late, `warning` for something due. */
  readonly tone: 'warning' | 'negative'
  readonly link: { readonly label: string; readonly to: RouteLocationRaw }
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
    text: notFiled > 0 ? plural(words.waiting.notFiled(notFiled), notFiled) : words.waiting.folderUnread,
    tone: 'warning',
    link: { label: words.waiting.links.import, to: { path: '/company/transactions', query: { tab: 'import' } } },
  }
}

function reviewJob(bankRows: readonly Transaction[]): WaitingJob | null {
  const count = bankRows.filter(needsReview).length
  if (count === 0) return null
  return {
    key: 'review',
    text: plural(words.waiting.toReview(count), count),
    tone: 'warning',
    link: { label: words.waiting.links.review, to: '/company/review' },
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
      ? plural(words.waiting.invoicesNotMade(due.length, monthInYear(oldest.month, yearOf(asOf))), due.length)
      : oldest.month === thisMonth
        ? words.waiting.thisMonthNotMade(clientName(oldest.client))
        : words.waiting.monthNotMade(monthInYear(oldest.month, yearOf(asOf)), clientName(oldest.client))
  return {
    key: 'invoice',
    text,
    tone: oldest.month < thisMonth ? 'negative' : 'warning',
    link: { label: words.waiting.links.invoicing, to: planMonthLink(oldest.month) },
  }
}

function overdueJob(workbook: Workbook, asOf: CivilDate): WaitingJob | null {
  const invoices = receivablesOf(workbook.transactions, workbook.categories, workbook.invoices, workbook.clients).clients.flatMap((entry) => entry.invoices)
  const { overdue, overdueCount } = amountsOwed(invoices, asOf)
  if (overdueCount === 0) return null
  return {
    key: 'overdue',
    text: plural(words.waiting.overdue(overdueCount, formatMoney(overdue)), overdueCount),
    tone: 'negative',
    link: { label: words.waiting.links.invoices, to: '/company/invoicing' },
  }
}
