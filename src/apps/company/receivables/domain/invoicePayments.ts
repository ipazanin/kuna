import { ZERO, absMoney, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { settlePayments } from '../../../../shared/money/settleOpenRows'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { movedPartId, paymentParts } from '../../workbook/domain/rowPayments'
import type { RowPayments } from '../../workbook/domain/rowPayments'
import { itemsOfRow, wholeItemId } from '../../workbook/domain/splits'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import { invoiceOrder } from '../../workbook/domain/workbook'
import type { Invoice, Transaction, Workbook } from '../../workbook/domain/workbook'
import { invoiceSharesOf, receivablesOf, revenueCategories } from './invoiceMatching'
import type { ReceivableBooks, Receivables } from './invoiceMatching'

/**
 * The items with each client payment's item split by what the receivables put on each invoice: what pays no invoice keeps the
 * item, and each invoice the payment pays gets an item of its own that names it, with the item's note and the id `partIdOf`
 * gives its place. A payment that pays one invoice in full stays one item that names it.
 */
export function matchedInvoiceItems(
  receivables: Receivables,
  items: readonly ItemRecord[],
  itemOf: (row: Transaction) => ItemRecord | undefined,
  partIdOf: (item: RecordId, place: number) => RecordId,
): readonly ItemRecord[] {
  const placed = new Map<RecordId, readonly ItemRecord[]>()
  for (const [row, shares] of invoiceSharesOf(receivables)) {
    const item = itemOf(row)
    if (item === undefined) continue
    const parts = paymentParts(
      item,
      shares.map((share) => ({ paid: { id: share.invoice, note: item.note }, applied: share.applied })),
      (place) => partIdOf(item.id, place),
    )
    placed.set(
      item.id,
      parts.map((part): ItemRecord => ({ ...item, id: part.id, amount: part.amount, note: part.note, invoice: part.of })),
    )
  }
  return items.flatMap((item) => placed.get(item.id) ?? [item])
}

/** What a row's items put on each invoice, by the invoice's id. */
export function invoiceTotals(items: readonly Pick<ItemRecord, 'amount' | 'invoice'>[]): ReadonlyMap<RecordId, Money> {
  const totals = new Map<RecordId, Money>()
  for (const { amount, invoice } of items) {
    if (invoice !== null) totals.set(invoice, addMoney(totals.get(invoice) ?? ZERO, amount))
  }
  return totals
}

/**
 * The invoices whose money a write moves when it leaves a row holding `written` in place of `held`, each written item with the
 * invoice it would keep paying. Money placed on an invoice changes only where a person places it, so a write that keeps the row
 * in revenue must put on each invoice what the row's items held. A write that refiles some of the row out of revenue takes those
 * items off their invoices, as `paidWhileRevenue` says, and may only lower what the row puts on each.
 */
export function invoicesMoved(
  held: readonly Pick<ItemRecord, 'amount' | 'invoice'>[],
  written: readonly Pick<ItemRecord, 'amount' | 'invoice' | 'category'>[],
  revenue: ReadonlySet<string>,
): readonly RecordId[] {
  const before = invoiceTotals(held)
  const after = invoiceTotals(written.filter((item) => revenue.has(item.category)))
  const refiled = written.some((item) => !revenue.has(item.category))
  return [...new Set([...before.keys(), ...after.keys()])].filter((invoice) => {
    const was = before.get(invoice) ?? ZERO
    const is = after.get(invoice) ?? ZERO
    return refiled ? absMoney(is) > absMoney(was) : is !== was
  })
}

/** The invoice an item in this category pays: the one it names while it is revenue, and none once it is filed elsewhere. */
export function paidWhileRevenue(invoice: RecordId | null, category: string, revenue: ReadonlySet<string>): RecordId | null {
  return revenue.has(category) ? invoice : null
}

/** The invoices a row's items pay that refiling the whole row in this category takes it off, in the order the books list them. */
export function invoicesRefiledOff(workbook: Pick<Workbook, 'splits' | 'categories' | 'invoices' | 'paidInvoices'>, row: Transaction, category: string): readonly Invoice[] {
  const { paidInvoices } = workbook
  if (paidInvoices === undefined || revenueCategories(workbook.categories).has(category)) return []
  const split = workbook.splits.find((held) => held.row.id === row.id)
  const paid = new Set(itemsOfRow(row, split).flatMap((item) => paidInvoices.get(item.id) ?? []))
  return workbook.invoices.filter((invoice) => paid.has(invoice.id))
}

/**
 * Which invoices the new rows of an import pay, on books that keep items: each new revenue credit from an IBAN a client names,
 * oldest first, against what each of that client's invoices still has open, as the receivables of the booked rows give it. A
 * credit first closes the fewest invoices it equals exactly, and failing that fills the oldest open ones, each reaching only the
 * invoices issued by its day. Each such row becomes its items: what pays no invoice under the row's own item id, then each
 * invoice's part under the id the move would give its place. A credit no invoice takes is left out.
 */
export function proposedInvoicePayments(books: ReceivableBooks, added: readonly LedgerEntry[]): RowPayments[] {
  const revenue = revenueCategories(books.categories)
  const clientOfIban = new Map(books.clients.flatMap((client) => client.ibans.map((iban) => [iban, client.slug] as const)))
  const credits = [...added]
    .reverse()
    .filter((entry) => entry.rowId !== null && entry.amount > 0 && revenue.has(entry.category) && clientOfIban.has(entry.counterpartyIban))
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
  if (credits.length === 0) return []
  return receivablesOf(books).clients.flatMap((client) => {
    const own = credits.filter((entry) => clientOfIban.get(entry.counterpartyIban) === client.client.slug)
    const open = client.invoices.filter((matched) => matched.remaining > 0).sort((earlier, later) => invoiceOrder(earlier.invoice, later.invoice))
    if (own.length === 0 || open.length === 0) return []
    const issuedBy = (payment: number, row: number) => open[row]!.invoice.issued <= own[payment]!.date
    const placed = settlePayments(
      open.map((matched) => matched.remaining),
      own.map((entry) => entry.amount),
      issuedBy,
      issuedBy,
    )
    return own.flatMap((entry, index): RowPayments[] => {
      const shares = placed[index]!
      if (shares.length === 0 || entry.rowId === null) return []
      const id = wholeItemId(entry)
      const paid = shares.map((share) => ({ paid: { id: open[share.index]!.invoice.id, note: '' }, applied: share.applied }))
      return [{ row: entry.rowId, items: paymentParts({ id, amount: entry.amount, note: '' }, paid, (place) => movedPartId(id, place)) }]
    })
  })
}
