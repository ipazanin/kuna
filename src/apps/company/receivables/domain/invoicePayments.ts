import { ZERO, absMoney, addMoney, minMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { settlePayments } from '../../../../shared/money/settleOpenRows'
import type { RowShare } from '../../../../shared/money/settleOpenRows'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { movedPartId, paymentParts, placedShares } from '../../workbook/domain/rowPayments'
import type { RowPayments } from '../../workbook/domain/rowPayments'
import { itemIdOfRow, itemsOfRow, wholeItemId } from '../../workbook/domain/splits'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import { invoiceOrder } from '../../workbook/domain/workbook'
import type { Invoice, Transaction, Workbook } from '../../workbook/domain/workbook'
import { invoiceSharesOf, receivablesOf, revenueCategories } from './invoiceMatching'
import type { ClientReceivables, MatchedInvoice, ReceivableBooks, Receivables } from './invoiceMatching'

/**
 * Each client payment's item split by what the receivables put on each invoice, by the item's id: what pays no invoice keeps the
 * item, and each invoice the payment pays gets an item of its own that names it, with the item's note and the id `partIdOf`
 * gives its place. A payment that pays one invoice in full stays one item that names it. Items of no client payment are left out.
 */
export function invoicePartsOf(
  receivables: Receivables,
  itemOf: (row: Transaction) => ItemRecord | undefined,
  partIdOf: (item: RecordId, place: number) => RecordId,
): ReadonlyMap<RecordId, readonly ItemRecord[]> {
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
  return placed
}

/** The items with each client payment's item split by what the receivables put on each invoice, as `invoicePartsOf` says. */
export function matchedInvoiceItems(
  receivables: Receivables,
  items: readonly ItemRecord[],
  itemOf: (row: Transaction) => ItemRecord | undefined,
  partIdOf: (item: RecordId, place: number) => RecordId,
): readonly ItemRecord[] {
  const placed = invoicePartsOf(receivables, itemOf, partIdOf)
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
 * oldest first, against what each of that client's invoices still has open, as the receivables of the booked rows give it, by
 * the rule `settledOnInvoices` states. Each such row becomes its items: what pays no invoice under the row's own item id, then each
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
    const { open, placed } = settledOnInvoices(client, own)
    return own.flatMap((entry, index): RowPayments[] => {
      const shares = placed[index] ?? []
      if (shares.length === 0 || entry.rowId === null) return []
      const id = wholeItemId(entry)
      const paid = shares.map((share) => ({ paid: { id: open[share.index]!.invoice.id, note: '' }, applied: share.applied }))
      return [{ row: entry.rowId, items: paymentParts({ id, amount: entry.amount, note: '' }, paid, (place) => movedPartId(id, place)) }]
    })
  })
}

/**
 * Where credits of a client, given oldest first, go among its open invoices, oldest first. A credit first fills the open invoices
 * whose numbers its description or reference names, since the payer said what it pays. The rest of it then closes the fewest invoices it
 * equals exactly, and failing that fills the oldest open ones, each reaching only the invoices issued by its day.
 */
function settledOnInvoices(
  client: ClientReceivables,
  credits: readonly Pick<Transaction, 'date' | 'amount' | 'description' | 'reference'>[],
): { readonly open: readonly MatchedInvoice[]; readonly placed: RowShare[][] } {
  const open = client.invoices.filter((matched) => matched.remaining > 0).sort((earlier, later) => invoiceOrder(earlier.invoice, later.invoice))
  if (credits.length === 0 || open.length === 0) return { open, placed: [] }
  const left = open.map((matched) => matched.remaining)
  const named = credits.map((credit) => {
    const shares: RowShare[] = []
    let unplaced = credit.amount
    open.forEach((matched, index) => {
      if (unplaced <= 0 || left[index]! <= 0 || !namesInvoice(credit, matched.invoice.number)) return
      const applied = minMoney(unplaced, left[index]!)
      shares.push({ index, applied })
      left[index] = subtractMoney(left[index]!, applied)
      unplaced = subtractMoney(unplaced, applied)
    })
    return shares
  })
  const issuedBy = (payment: number, row: number) => open[row]!.invoice.issued <= credits[payment]!.date
  const settled = settlePayments(
    left,
    credits.map((credit, payment) => subtractMoney(credit.amount, sumMoney(named[payment]!.map((share) => share.applied)))),
    issuedBy,
    issuedBy,
  )
  return { open, placed: named.map((shares, payment) => [...shares, ...settled[payment]!].sort((earlier, later) => earlier.index - later.index)) }
}

/** A character that continues an invoice number, so a match beside it is part of a longer one. */
const NUMBER_PART = /[\p{L}\p{N}/-]/u

/** Whether a payment's description or reference names an invoice's number as a whole word, so `11-1-26` does not name `1-1-26`. */
function namesInvoice(payment: Pick<Transaction, 'description' | 'reference'>, number: string): boolean {
  if (number === '') return false
  return [payment.description, payment.reference].some((text) => {
    for (let at = text.indexOf(number); at >= 0; at = text.indexOf(number, at + 1)) {
      const before = text[at - 1] ?? ' '
      const after = text[at + number.length] ?? ' '
      if (!NUMBER_PART.test(before) && !NUMBER_PART.test(after)) return true
    }
    return false
  })
}

/**
 * The invoice of the client a payment no invoice holds is placed on first: the one the import's rule gives it, as
 * `settledOnInvoices` says, or else the client's oldest open invoice, since a client may pay ahead. Null when none is open.
 */
export function invoiceToPlace(books: ReceivableBooks, client: string, payment: Pick<Transaction, 'date' | 'amount' | 'description' | 'reference'>): Invoice | null {
  const held = receivablesOf(books).clients.find((entry) => entry.client.slug === client)
  if (held === undefined) return null
  const { open, placed } = settledOnInvoices(held, [payment])
  const [first] = placed[0] ?? []
  return (first === undefined ? open[0] : open[first.index])?.invoice ?? null
}

/** A revenue credit a person may place on an invoice: money one item holds, which the invoice holds already or no invoice does. */
export interface PaymentChoice {
  /** Names the choice in a list: its item, and whether the invoice holds it. */
  readonly key: string
  readonly item: RecordId
  /** The credit as the books list it, a part of a split row its own. */
  readonly payment: Transaction
  /** What of it the invoice holds, or for one it does not what of it no invoice holds. */
  readonly amount: Money
  /** Whether the invoice holds it already. */
  readonly named: boolean
}

/** The key of the choice of an item's money: what the invoice holds of it, or what no invoice holds. */
export function paymentChoiceKey(item: RecordId, named: boolean): string {
  return `${item} ${named ? 'held' : 'free'}`
}

/** What of a credit's money pays an invoice, or none. */
interface CreditShare {
  readonly invoice: RecordId | null
  readonly amount: Money
}

/**
 * How each revenue credit's money sits on the invoices: on books that store it, all of it on the invoice its item names or on
 * none, and on books that match on every read what the matching puts on each invoice and then the rest on none, as placing the
 * payments would store it.
 */
function creditShares(books: Pick<ReceivableBooks, 'paidInvoices'>, receivables: Receivables): (row: Transaction) => readonly CreditShare[] {
  const { paidInvoices } = books
  if (paidInvoices !== undefined) return (row) => [{ invoice: paidInvoices.get(itemIdOfRow(row)) ?? null, amount: row.amount }]
  const shares = invoiceSharesOf(receivables)
  return (row) => {
    const paid = shares.get(row) ?? []
    const rest = subtractMoney(row.amount, sumMoney(paid.map((share) => share.applied)))
    return [...(rest > 0 ? [{ invoice: null, amount: rest }] : []), ...paid.map((share) => ({ invoice: share.invoice, amount: share.applied }))]
  }
}

/**
 * The revenue credits a person may place on an invoice, oldest first: what of each the invoice holds already, and what no invoice
 * holds of each from the client or from an IBAN no client names, with no limit on the day, since a client may pay ahead. `held`
 * is the invoice as the books hold it, or null for a new one.
 */
export function paymentChoices(books: ReceivableBooks, held: RecordId | null, client: string): PaymentChoice[] {
  const receivables = receivablesOf(books)
  const sharesOf = creditShares(books, receivables)
  const free = new Set([...(receivables.clients.find((entry) => entry.client.slug === client)?.payments ?? []).map((payment) => payment.payment), ...receivables.unattributedCredits])
  const credits = [...receivables.clients.flatMap((entry) => entry.payments.map((payment) => payment.payment)), ...receivables.unattributedCredits]
  return credits
    .flatMap((credit) =>
      sharesOf(credit.transaction).flatMap((share): PaymentChoice[] => {
        const named = held !== null && share.invoice === held
        if (share.amount <= 0 || !(named || (share.invoice === null && free.has(credit)))) return []
        const item = itemIdOfRow(credit.transaction)
        return [{ key: paymentChoiceKey(item, named), item, payment: credit.transaction, amount: share.amount, named }]
      }),
    )
    .sort((earlier, later) => earlier.payment.date.localeCompare(later.payment.date) || earlier.payment.sequence - later.payment.sequence)
}

/** The parts of the money a write places on an invoice: the item that holds each, what of it the invoice holds or may take, and whether it holds it already. */
export interface PlacedPayment {
  readonly item: RecordId
  readonly amount: Money
  readonly named: boolean
}

/**
 * The items once the chosen payments pay the invoice, and the ones it held that are not chosen pay none. A payment it holds
 * already stays as it is. A new one pays what is still open of the invoice, as `placedShares` says: an item it pays in full names
 * the invoice, and one it pays in part gives that part to an item of its own under the id `newId` gives, while the rest keeps the
 * item's id. A payment the invoice no longer needs is left out. An item whose invoice changes joins an item of its row with the
 * same category, note, share and invoice, so taking a payment off puts it back where it was split from.
 */
export function placedOnInvoice(items: readonly ItemRecord[], invoice: Pick<Invoice, 'id' | 'amount'>, chosen: readonly PlacedPayment[], newId: () => RecordId): ItemRecord[] {
  const applied = placedShares(invoice.amount, chosen)
  const kept = new Set(chosen.filter((payment) => payment.named).map((payment) => payment.item))
  const moved = new Set<RecordId>()
  const placed = items.flatMap((item): ItemRecord[] => {
    if (item.invoice === invoice.id) {
      if (kept.has(item.id)) return [item]
      moved.add(item.id)
      return [{ ...item, invoice: null }]
    }
    const index = chosen.findIndex((payment) => !payment.named && payment.item === item.id)
    const share = index < 0 ? ZERO : applied[index]!
    if (share <= 0) return [item]
    const parts = paymentParts(item, [{ paid: { id: invoice.id, note: item.note }, applied: share }], newId)
    parts.forEach((part) => moved.add(part.id))
    return parts.map((part): ItemRecord => ({ ...item, id: part.id, amount: part.amount, note: part.note, invoice: part.of }))
  })
  return joinedParts(placed, moved)
}

/** The items with each moved one joined to the first item of its row it matches in category, note, share and invoice. */
function joinedParts(items: readonly ItemRecord[], moved: ReadonlySet<RecordId>): ItemRecord[] {
  const joined: ItemRecord[] = []
  for (const item of items) {
    const same = joined.findIndex(
      (held) =>
        held.row === item.row &&
        (moved.has(held.id) || moved.has(item.id)) &&
        held.category === item.category &&
        held.note === item.note &&
        held.ownerShare === item.ownerShare &&
        held.invoice === item.invoice,
    )
    if (same < 0) joined.push(item)
    else joined[same] = { ...joined[same]!, amount: addMoney(joined[same]!.amount, item.amount) }
  }
  return joined
}
