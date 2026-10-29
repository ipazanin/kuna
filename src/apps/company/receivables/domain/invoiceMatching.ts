import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Category, Client, Invoice, Transaction } from '../../workbook/domain/workbook'
import { NO_CLIENT_INVOICING, invoiceOrder } from '../../workbook/domain/workbook'

/** The category roles receivables select by, as the `roles` column of `categories` spells them. */
export const RECEIVABLE_ROLES = {
  revenue: 'revenue',
  clientRefund: 'client-refund',
} as const

export type InvoiceStatus = 'paid' | 'partial' | 'outstanding'

/** One bank row the matching used, with the drill that opens it on Transactions. */
export interface PaymentRow {
  readonly transaction: Transaction
  readonly drill: DrillTarget
}

/** The part of one payment that went towards one invoice. */
export interface InvoiceAllocation {
  readonly payment: PaymentRow
  readonly amount: Money
}

export interface MatchedInvoice {
  readonly invoice: Invoice
  /** What is still owed on it, never negative. */
  readonly remaining: Money
  readonly status: InvoiceStatus
  /** The day of the payment that settled it. Null until it is paid, and on an invoice of nothing. */
  readonly received: CivilDate | null
  /** The payments that went towards it, oldest first. */
  readonly allocations: readonly InvoiceAllocation[]
  /** What payments ran past their capacity while this was the newest invoice they could reach, newest first. */
  readonly overpayments: readonly InvoiceAllocation[]
}

export interface MatchedPayment {
  readonly payment: PaymentRow
  /** What went towards invoices. */
  readonly applied: Money
  /** What no invoice issued by its date could take. */
  readonly leftover: Money
}

export interface ClientReceivables {
  readonly client: Client
  /** In the order they were given. */
  readonly invoices: readonly MatchedInvoice[]
  /** Oldest first. */
  readonly payments: readonly MatchedPayment[]
  readonly outstanding: Money
  /** Leftovers of payments that applied something. */
  readonly overpaid: Money
  /** Leftovers of payments that applied nothing: a credit with no invoice on file. */
  readonly creditsWithNoInvoice: Money
  /** Client refunds paid back to the client's IBANs, read positive. */
  readonly refunded: Money
}

export interface Receivables {
  /** Every client the clients tab names, then any client an invoice names that the tab does not. */
  readonly clients: readonly ClientReceivables[]
  /** Revenue credits from an IBAN no client names. They are never matched to anyone's invoices. */
  readonly unattributedCredits: readonly PaymentRow[]
  /** Client refunds to an IBAN no client names. */
  readonly unattributedRefunds: readonly PaymentRow[]
}

/**
 * Invoices against the revenue credits that paid them, client by client. A payment belongs to the
 * client whose IBAN sent it. Revenue and client refunds are the categories with those roles.
 */
export function receivablesOf(transactions: readonly Transaction[], categories: readonly Category[], invoices: readonly Invoice[], clients: readonly Client[]): Receivables {
  const revenue = categoriesWithRole(categories, RECEIVABLE_ROLES.revenue)
  const refunds = categoriesWithRole(categories, RECEIVABLE_ROLES.clientRefund)
  const clientOfIban = new Map(clients.flatMap((client) => client.ibans.map((iban) => [iban, client.slug] as const)))
  const credits = transactions.filter((transaction) => revenue.has(transaction.category) && transaction.amount > 0)
  const refundRows = transactions.filter((transaction) => refunds.has(transaction.category) && transaction.amount < 0)
  const named = new Set(clients.map((client) => client.slug))
  const everyClient = [
    ...clients,
    ...[...new Set(invoices.map((invoice) => invoice.client))].filter((slug) => !named.has(slug)).map((slug): Client => ({ slug, name: '', ibans: [], invoicing: NO_CLIENT_INVOICING })),
  ]
  return {
    clients: everyClient.map((client) => {
      const own = (row: Transaction) => clientOfIban.get(row.counterpartyIban) === client.slug
      return {
        ...matchClientInvoices(
          client,
          invoices.filter((invoice) => invoice.client === client.slug),
          credits.filter(own),
        ),
        refunded: negateMoney(sumMoney(refundRows.filter(own).map((row) => row.amount))),
      }
    }),
    unattributedCredits: oldestFirst(credits.filter((row) => !clientOfIban.has(row.counterpartyIban))).map(paymentRow),
    unattributedRefunds: oldestFirst(refundRows.filter((row) => !clientOfIban.has(row.counterpartyIban))).map(paymentRow),
  }
}

/**
 * The scan for one client. Invoices are filled in the order they were issued, by issue date and
 * then by number. Each payment, oldest first, can fill only the invoices already issued on its
 * day, less what earlier payments filled. So a credit that arrives before its invoice is a credit
 * with no invoice, and an overpayment never makes anything owed negative.
 */
export function matchClientInvoices(client: Client, invoices: readonly Invoice[], credits: readonly Transaction[]): Omit<ClientReceivables, 'refunded'> {
  const register = [...invoices].sort(invoiceOrder)
  const payments = oldestFirst(credits).map(paymentRow)

  let appliedSoFar = ZERO
  const appliedBefore: Money[] = []
  const appliedAfter: Money[] = []
  for (const payment of payments) {
    const issuedByThen = sumMoney(register.filter((invoice) => invoice.issued <= payment.transaction.date).map((invoice) => invoice.amount))
    const capacity = maxMoney(ZERO, subtractMoney(issuedByThen, appliedSoFar))
    appliedBefore.push(appliedSoFar)
    appliedSoFar = addMoney(appliedSoFar, minMoney(payment.transaction.amount, capacity))
    appliedAfter.push(appliedSoFar)
  }
  const totalApplied = appliedSoFar

  const matchedPayments = payments.map((payment, index): MatchedPayment => {
    const applied = subtractMoney(appliedAfter[index]!, appliedBefore[index]!)
    return { payment, applied, leftover: subtractMoney(payment.transaction.amount, applied) }
  })
  // A leftover lands on the newest invoice for more than nothing that its payment could reach.
  const overpayTargets = payments.map((payment) => register.reduce((target, invoice, position) => (invoice.issued <= payment.transaction.date && invoice.amount > 0 ? position : target), -1))

  let cumulative = ZERO
  const matched = register.map((invoice, position): MatchedInvoice => {
    const filledBefore = cumulative
    cumulative = addMoney(cumulative, invoice.amount)
    const remaining = subtractMoney(invoice.amount, minMoney(invoice.amount, maxMoney(ZERO, subtractMoney(totalApplied, filledBefore))))
    const settledBy = appliedAfter.findIndex((applied) => applied >= cumulative)
    const allocations = payments.flatMap((payment, index): InvoiceAllocation[] => {
      const amount = overlap(appliedBefore[index]!, appliedAfter[index]!, filledBefore, cumulative)
      return amount > 0 ? [{ payment, amount }] : []
    })
    const overpayments = matchedPayments
      .flatMap((payment, index) => (overpayTargets[index] === position && payment.leftover > 0 && payment.applied > 0 ? [{ payment: payment.payment, amount: payment.leftover }] : []))
      .reverse()
    return {
      invoice,
      remaining,
      status: remaining <= 0 ? 'paid' : remaining < invoice.amount ? 'partial' : 'outstanding',
      received: invoice.amount <= 0 || settledBy === -1 ? null : payments[settledBy]!.transaction.date,
      allocations,
      overpayments,
    }
  })

  return {
    client,
    invoices: invoices.map((invoice) => matched.find((candidate) => candidate.invoice === invoice)!),
    payments: matchedPayments,
    outstanding: sumMoney(matched.map((invoice) => invoice.remaining)),
    overpaid: sumMoney(matchedPayments.filter((payment) => payment.applied > 0).map((payment) => payment.leftover)),
    creditsWithNoInvoice: sumMoney(matchedPayments.filter((payment) => payment.applied <= 0).map((payment) => payment.leftover)),
  }
}

/** The length both stretches of the running totals share. */
function overlap(fromA: Money, toA: Money, fromB: Money, toB: Money): Money {
  return maxMoney(ZERO, subtractMoney(minMoney(toA, toB), maxMoney(fromA, fromB)))
}

function categoriesWithRole(categories: readonly Category[], role: string): ReadonlySet<string> {
  return new Set(categories.filter((category) => category.roles.includes(role)).map((category) => category.slug))
}

/** Booking order: by date, then the order the bank booked them within the day. */
function oldestFirst(rows: readonly Transaction[]): Transaction[] {
  return [...rows].sort((earlier, later) => earlier.date.localeCompare(later.date) || earlier.sequence - later.sequence)
}

/** The one row, found again by its day, category, counterparty and exact amount. */
function paymentRow(transaction: Transaction): PaymentRow {
  return {
    transaction,
    drill: drillToTransactions({
      period: { preset: 'custom', range: { from: transaction.date, to: transaction.date } },
      categories: [transaction.category],
      counterparties: [counterpartyIdentity(transaction).key],
      amount: { min: transaction.amount, max: transaction.amount },
    }),
  }
}

function minMoney(left: Money, right: Money): Money {
  return (left < right ? left : right) as Money
}

function maxMoney(left: Money, right: Money): Money {
  return (left > right ? left : right) as Money
}
