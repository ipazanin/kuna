import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, maxMoney, minMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import { itemIdOfRow } from '../../workbook/domain/splits'
import type { Category, Client, Invoice, Transaction, Workbook } from '../../workbook/domain/workbook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
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
  /** What payments paid past the invoices they reached. */
  readonly overpaid: Money
  /** What payments paid with no invoice to take it: a credit with no invoice on file, or one nobody placed yet. */
  readonly creditsWithNoInvoice: Money
  /** Client refunds paid back to the client's IBANs, read positive. */
  readonly refunded: Money
  /**
   * On books that store the invoice each payment pays, the client's payments no invoice holds, oldest first, which wait for a
   * person to place them. Absent on other books, which match the payments to the invoices on every read.
   */
  readonly unplaced?: readonly PaymentRow[]
}

export interface Receivables {
  /** Every client the clients tab names, then any client an invoice names that the tab does not. */
  readonly clients: readonly ClientReceivables[]
  /** Revenue credits from an IBAN no client names that pay no invoice. They are never matched to anyone's invoices. */
  readonly unattributedCredits: readonly PaymentRow[]
  /** Client refunds to an IBAN no client names. */
  readonly unattributedRefunds: readonly PaymentRow[]
}

/** What receivables read of the books: the rows as booked, and on books that store it the invoice each item pays. */
export type ReceivableBooks = Pick<Workbook, 'transactions' | 'categories' | 'invoices' | 'clients' | 'paidInvoices'>

/** Who a revenue credit is from, and where its money goes: the invoice it pays, and for what pays none the invoice it overpays. */
interface CreditPlace {
  readonly client: string | undefined
  readonly invoice: RecordId | null
  readonly overpays: RecordId | null
}

/**
 * Invoices against the revenue credits that paid them, client by client. Revenue and client refunds are the categories with those
 * roles, and a refund belongs to the client whose IBAN it went to. On books that store which invoice each item pays, a payment
 * belongs to the client of the invoice it or its row pays, or else to the client whose IBAN sent it. Other books match each
 * client's credits to its invoices on every read, as `matchClientInvoices` does.
 */
export function receivablesOf(books: ReceivableBooks): Receivables {
  const { transactions, categories, invoices, clients, paidInvoices } = books
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
  const placeOf =
    paidInvoices === undefined
      ? (row: Transaction): CreditPlace => ({ client: clientOfIban.get(row.counterpartyIban), invoice: null, overpays: null })
      : creditPlaces(credits, invoices, paidInvoices, clientOfIban)
  return {
    clients: everyClient.map((client) => {
      const own = credits.filter((row) => placeOf(row).client === client.slug)
      const clientInvoices = invoices.filter((invoice) => invoice.client === client.slug)
      return {
        ...(paidInvoices === undefined ? matchClientInvoices(client, clientInvoices, own) : placedClientInvoices(client, clientInvoices, own, placeOf)),
        refunded: negateMoney(sumMoney(refundRows.filter((row) => clientOfIban.get(row.counterpartyIban) === client.slug).map((row) => row.amount))),
      }
    }),
    unattributedCredits: oldestFirst(credits.filter((row) => placeOf(row).client === undefined)).map(paymentRow),
    unattributedRefunds: oldestFirst(refundRows.filter((row) => !clientOfIban.has(row.counterpartyIban))).map(paymentRow),
  }
}

/**
 * Where each credit's money goes on books that store it. An item pays the invoice it names. An item of a row whose other items
 * pay invoices overpays the newest of them, which is where the matching on every read puts the rest of such a payment.
 */
function creditPlaces(
  credits: readonly Transaction[],
  invoices: readonly Invoice[],
  paidInvoices: ReadonlyMap<RecordId, RecordId>,
  clientOfIban: ReadonlyMap<string, string>,
): (row: Transaction) => CreditPlace {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]))
  const invoiceOf = (row: Transaction): Invoice | null => {
    const paid = paidInvoices.get(itemIdOfRow(row))
    return paid === undefined ? null : (invoiceById.get(paid) ?? null)
  }
  const bankRowOf = (row: Transaction) => row.split?.whole.id ?? row.id
  const newestPaid = new Map<RecordId, Invoice>()
  for (const row of credits) {
    const invoice = invoiceOf(row)
    const newest = newestPaid.get(bankRowOf(row))
    if (invoice !== null && (newest === undefined || invoiceOrder(newest, invoice) < 0)) newestPaid.set(bankRowOf(row), invoice)
  }
  const places = new Map(
    credits.map((row): [Transaction, CreditPlace] => {
      const invoice = invoiceOf(row)
      const overpays = invoice === null ? (newestPaid.get(bankRowOf(row)) ?? null) : null
      return [row, { client: (invoice ?? overpays)?.client ?? clientOfIban.get(row.counterpartyIban), invoice: invoice?.id ?? null, overpays: overpays?.id ?? null }]
    }),
  )
  return (row) => places.get(row)!
}

/**
 * One client's invoices against the payments the books store for them. Each invoice takes what the items that pay it hold, oldest
 * first, up to its amount, and is received on the day of the payment that brings it there. What they hold past it, as after the
 * invoice was lowered, overpays it, and so does an item that pays none beside items of its row that pay it. A payment that pays
 * no invoice waits to be placed.
 */
function placedClientInvoices(client: Client, invoices: readonly Invoice[], credits: readonly Transaction[], placeOf: (row: Transaction) => CreditPlace): Omit<ClientReceivables, 'refunded'> {
  const payments = oldestFirst(credits).map(paymentRow)
  const applied = new Map<PaymentRow, Money>()
  const matched = invoices.map((invoice): MatchedInvoice => {
    let filled = ZERO
    let received: CivilDate | null = null
    const allocations: InvoiceAllocation[] = []
    const overpayments: InvoiceAllocation[] = []
    for (const payment of payments) {
      const place = placeOf(payment.transaction)
      const { amount } = payment.transaction
      if (place.overpays === invoice.id) overpayments.push({ payment, amount })
      if (place.invoice !== invoice.id) continue
      const taken = minMoney(amount, maxMoney(ZERO, subtractMoney(invoice.amount, filled)))
      filled = addMoney(filled, taken)
      applied.set(payment, taken)
      if (taken > 0) allocations.push({ payment, amount: taken })
      if (taken < amount) overpayments.push({ payment, amount: subtractMoney(amount, taken) })
      if (received === null && invoice.amount > 0 && filled >= invoice.amount) received = payment.transaction.date
    }
    const remaining = subtractMoney(invoice.amount, minMoney(invoice.amount, filled))
    return { invoice, remaining, status: invoiceStatus(invoice, remaining), received, allocations, overpayments: overpayments.reverse() }
  })
  const unplaced = payments.filter((payment) => {
    const place = placeOf(payment.transaction)
    return place.invoice === null && place.overpays === null
  })
  return {
    client,
    invoices: matched,
    payments: payments.map((payment): MatchedPayment => {
      const taken = applied.get(payment) ?? ZERO
      return { payment, applied: taken, leftover: subtractMoney(payment.transaction.amount, taken) }
    }),
    outstanding: sumMoney(matched.map((invoice) => invoice.remaining)),
    overpaid: sumMoney(matched.flatMap((invoice) => invoice.overpayments.map((overpayment) => overpayment.amount))),
    creditsWithNoInvoice: sumMoney(unplaced.map((payment) => payment.transaction.amount)),
    unplaced,
  }
}

/** Paid once nothing is owed, partly paid once something came in, and outstanding before. */
function invoiceStatus(invoice: Pick<Invoice, 'amount'>, remaining: Money): InvoiceStatus {
  return remaining <= 0 ? 'paid' : remaining < invoice.amount ? 'partial' : 'outstanding'
}

/** What of a payment goes towards one invoice. */
export interface InvoiceShare {
  readonly invoice: RecordId
  readonly applied: Money
}

/** What of each payment row goes towards each invoice, by the row as the receivables list it, in the order the invoices are given. */
export function invoiceSharesOf(receivables: Receivables): ReadonlyMap<Transaction, readonly InvoiceShare[]> {
  const shares = new Map<Transaction, InvoiceShare[]>()
  for (const matched of receivables.clients.flatMap((client) => client.invoices)) {
    for (const { payment, amount } of matched.allocations) {
      shares.set(payment.transaction, [...(shares.get(payment.transaction) ?? []), { invoice: matched.invoice.id, applied: amount }])
    }
  }
  return shares
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
      status: invoiceStatus(invoice, remaining),
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
