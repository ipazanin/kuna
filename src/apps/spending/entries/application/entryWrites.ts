import type { EntrySplit } from '../domain/entrySplit'
import type { TypedTransfer } from '../domain/transfer'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import { CATEGORY_WRITES } from '../../categories/application/categoryWrites'
import { eventOfLargest, payeeOfAll, ruleLabelsOf } from '../../workbook/domain/carriedChoices'
import { linkedEntry, linkedWithExtraPayment } from '../../links/domain/linkFiling'
import type { LinkPlace, LinkedEntry } from '../../links/domain/linkFiling'
import type { ExtraPaymentTarget, InstalmentTarget, LinkTarget } from '../../links/domain/linkTarget'
import { addPartPayees } from '../../payees/application/payeeWrites'
import type { PartPayeeRecords } from '../../payees/application/payeeWrites'
import { partPayeeOf } from '../../payees/domain/payeeKey'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { heldItemsOf, writeRows } from './rowRecords'
import type { RowWrite } from './rowRecords'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { EventChoice } from '../../workbook/domain/event'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { RowLink } from '../../workbook/domain/rowLink'
import { isSplit, largestItem, linkOfItems, unlinkedItems, wholeItemOf } from '../../workbook/domain/rowItems'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

/** The rows and items an entry write reads of the file, and the payees and entries it reads to add the names its parts count under. */
type EntryRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>

/** What a write that may give parts a payee of their own reads of the file. */
type FilingRecords = EntryRecords & PartPayeeRecords

/** What you type for an entry not split: its category, or none while it waits on review, its note, its labels, its event and who it counts under. */
export interface TypedFiling {
  readonly category: RecordId | null
  readonly note: string
  readonly labels: readonly RecordId[]
  /** Left out, the money joins an event by its row's day. */
  readonly event?: EventChoice
  /** Who the money counts under when that is not the entry's payee, such as the friend a meal paid for. Left out or blank, the entry's payee. */
  readonly countsUnder?: string
}

/** A new typed entry, its text trimmed, with an id of its own and one item with all of its money. */
export function newEntry(entry: Pick<Transaction, 'account' | 'date' | 'amount' | 'payee'> & TypedFiling): ItemizedRow {
  const { category, note, labels, event, countsUnder = '', ...typed } = entry
  const row: Transaction = { ...typed, ...NO_BANK_FACTS, payee: entry.payee.trim(), source: 'typed', pair: null, categorisedBy: 'person', id: recordIdOf(TRANSACTION_RECORDS, newRecordId()) }
  return { row, items: [wholeItemOf(row, { category, note: note.trim(), link: null, labels, countsUnder: partPayeeOf(countsUnder, row.payee), ...(event === undefined ? {} : { event }) })] }
}

/**
 * What you typed over a row on the file. It keeps its id, its source and what the bank said, so a later statement still skips
 * it. A row not split keeps its one item's id and link and takes the typed amount, category, note, labels, event and payee it
 * counts under, keeping the payee it counted under when the typed one names none, and a category you changed is yours from then on. A split row keeps its items, each with the labels and event of
 * the typed part of its id, and a receipt's line takes that part's category, note and payee too, while its amount stays the
 * receipt's. A part left counting under the entry's new payee keeps no payee of its own.
 */
export function retypedEntry(before: ItemizedRow, typed: ItemizedRow): ItemizedRow {
  const { description, counterpartyIban, importKey, statement, movedAt, pocket, id, source } = before.row
  const [held] = before.items
  const [filing] = typed.items
  const whole = held !== undefined && filing !== undefined && !isSplit(before.items)
  const typedParts = new Map(typed.items.map((part) => [part.id, part]))
  const ownPayee = (payee: string): string => partPayeeOf(payee, typed.row.payee)
  const parts = before.items.map((part) => {
    const typedPart = typedParts.get(part.id)
    const refiled = part.receipt === null || typedPart === undefined ? {} : { category: typedPart.category ?? part.category, note: typedPart.note, payee: typedPart.payee }
    const retyped = { ...part, labels: typedPart?.labels ?? part.labels, event: typedPart?.event ?? part.event, ...refiled }
    return { ...retyped, payee: ownPayee(retyped.payee) }
  })
  const filedAnew = whole ? held.category !== filing.category : parts.some((part, place) => part.category !== before.items[place]?.category)
  const row: Transaction = { ...typed.row, description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, categorisedBy: filedAnew ? 'person' : before.row.categorisedBy }
  if (!whole) return { row, items: parts }
  const payee = ownPayee(filing.payee === '' ? held.payee : filing.payee)
  return { row, items: [{ ...held, amount: row.amount, category: filing.category, note: filing.note, labels: filing.labels, event: filing.event, payee }] }
}

/** A transfer's leg typed over a row, which keeps the row's labels, since a transfer is labelled by selecting it on Entries. */
function legOver(before: ItemizedRow, typed: ItemizedRow): ItemizedRow {
  const labels = labelsOf(before.items)
  const event = eventOfLargest(before.items)
  return retypedEntry(before, { ...typed, items: typed.items.map((item) => ({ ...item, labels, event })) })
}

/**
 * A plain row turned into a transfer: it stays the leg its money already is, so money in stays money in, and keeps its labels,
 * and the other leg joins it.
 */
export function transferOver(before: ItemizedRow, [outLeg, inLeg]: readonly [ItemizedRow, ItemizedRow]): { readonly kept: ItemizedRow; readonly added: ItemizedRow } {
  const [stays, joins] = before.row.amount < 0 ? [outLeg, inLeg] : [inLeg, outLeg]
  const kept = legOver(before, stays)
  return { kept: { ...kept, row: { ...kept.row, pair: joins.row.id } }, added: { ...joins, row: { ...joins.row, pair: before.row.id } } }
}

function changed(before: ItemizedRow, after: ItemizedRow): RowWrite {
  return { before: before.row, after: after.row, items: after.items }
}

function added(after: ItemizedRow): RowWrite {
  return { before: null, after: after.row, items: after.items }
}

/**
 * The entry typed over a row on the file, or added when there is none. A transfer's other leg goes, since the row is a plain entry
 * now. A name its parts count under that no payee holds yet joins the payees as a person in the same write.
 */
export function writeEntry(unit: UnitOfWork, records: FilingRecords, before: ItemizedRow | null, entry: ItemizedRow, otherLeg: Transaction | null): void {
  const written = before === null ? entry : retypedEntry(before, entry)
  addPartPayees(unit, records, written.items)
  writeRows(unit, records, before === null ? [added(written)] : [changed(before, written), ...(otherLeg === null ? [] : [{ before: otherLeg, after: null }])])
}

/**
 * Both legs of a transfer in one write: added, a plain row turned into the leg its money already is, or written over the
 * transfer it was, each leg keeping its labels. A fee row the transfer brings is added in the same write, so one Undo takes it back too.
 */
export function writeTransfer(unit: UnitOfWork, records: EntryRecords, before: ItemizedRow | null, legs: readonly [ItemizedRow, ItemizedRow] | null, typed: TypedTransfer): void {
  const [outLeg, inLeg] = typed.legs
  const fee = typed.fee === null ? [] : [added(typed.fee)]
  if (before === null) {
    writeRows(unit, records, [added(outLeg), added(inLeg), ...fee])
  } else if (legs === null) {
    const { kept, added: joined } = transferOver(before, typed.legs)
    writeRows(unit, records, [changed(before, kept), added(joined), ...fee])
  } else {
    const [oldOut, oldIn] = legs
    const out = legOver(oldOut, outLeg)
    const into = legOver(oldIn, inLeg)
    writeRows(unit, records, [changed(oldOut, { ...out, row: { ...out.row, pair: oldIn.row.id } }), changed(oldIn, { ...into, row: { ...into.row, pair: oldOut.row.id } }), ...fee])
  }
}

/**
 * The entry linked to the record in Loans it is, in one write, with the categories it needs added in the same write. An
 * instalment splits it as `linkFiling` says, and any other link leaves each item as it is with the link on it.
 */
export function linkEntry(unit: UnitOfWork, records: EntryRecords, row: Transaction, target: LinkTarget, place: LinkPlace, newKey: () => string = newRecordId): LinkedEntry {
  const receipt = recordsOf(records.receipts).some((held) => held.transaction === row.id)
  return writeLinked(unit, records, row, linkedEntry({ row, items: heldItemsOf(records)(row) }, target, { ...place, receipt }, newKey))
}

/** Links the entry to its instalment and to the extra payment it also pays, split as `linkedWithExtraPayment` says, in one write. */
export function linkWithExtraPayment(
  unit: UnitOfWork,
  records: EntryRecords,
  row: Transaction,
  instalment: InstalmentTarget,
  extra: ExtraPaymentTarget,
  place: LinkPlace,
  newKey: () => string = newRecordId,
): LinkedEntry {
  return writeLinked(unit, records, row, linkedWithExtraPayment({ row, items: heldItemsOf(records)(row) }, instalment, extra, place, newKey))
}

/** Writes the entry as a link left it, with the categories the link added. */
function writeLinked(unit: UnitOfWork, records: EntryRecords, row: Transaction, linked: LinkedEntry): LinkedEntry {
  linked.added.forEach((category) => unit.of(CATEGORY_WRITES).add(category))
  writeRows(unit, records, [{ before: row, after: linked.entry.row, items: linked.entry.items }])
  return linked
}

/** Each entry linked to its record in Loans as `linkEntry` links it, in one write, so one Undo takes them all back. A category the first needs is added once. */
export function linkEntries(
  unit: UnitOfWork,
  records: EntryRecords,
  links: readonly { readonly row: Transaction; readonly target: LinkTarget; readonly currency: CurrencyCode }[],
  place: Omit<LinkPlace, 'currency'>,
  newKey: () => string = newRecordId,
): void {
  let categories = place.categories
  for (const { row, target, currency } of links) categories = [...categories, ...linkEntry(unit, records, row, target, { ...place, currency, categories }, newKey).added]
}

/** Takes the link off the entry's parts that carry it, and parts linked elsewhere keep theirs. Its parts stay as they are, so principal an instalment split off stays principal. */
export function unlinkEntry(unit: UnitOfWork, records: EntryRecords, row: Transaction, link: RowLink): void {
  writeRows(unit, records, [{ before: row, after: row, items: unlinkedItems(heldItemsOf(records)(row), link) }])
}

/** Whether deleting these rows lets the next overlapping statement bring one back, since nothing remembers a deleted row's key. */
export function deleteComesBack(rows: readonly Transaction[]): boolean {
  return rows.some((row) => row.importKey !== '')
}

/** The entry's other leg in the file, or null for an entry that is no transfer's leg. */
export function otherLegOf(records: Pick<SpendingRecords, 'transactions'>, entry: Transaction): Transaction | null {
  return entry.pair === null ? null : (recordsOf(records.transactions).find((other) => other.id === entry.pair) ?? null)
}

/** Deletes the entry with its other leg, their items and their receipts in one write, so one Undo puts them all back. A photo kept on Drive stays there. */
export function removeEntry(unit: UnitOfWork, records: EntryRecords, entry: Transaction): void {
  const other = otherLegOf(records, entry)
  const rows = other === null ? [entry] : [entry, other]
  writeRows(
    unit,
    records,
    rows.map((row) => ({ before: row, after: null })),
  )
  removeReceiptsOf(unit, records, rows)
}

/**
 * The entry with the parts you split it into, in one write. A part with the id of one the entry holds changes in place, the
 * others are added, and a held part no new part names goes. A part whose labels and event choice you set keeps them as set. A
 * name a part counts under that no payee holds yet joins the payees as a person in the same write.
 */
export function writeEntrySplit(unit: UnitOfWork, records: FilingRecords, { row, before, parts, chosen }: EntrySplit): void {
  addPartPayees(unit, records, parts)
  writeRows(unit, records, [{ before: before.row, after: row, items: parts, chosen }])
}

/**
 * The one item a split row stands for again: all of its money under the category most of it was in, with the note and event
 * choice of its largest part, its link and every label of its parts, a rule's still its, and the payee every part counted under.
 */
export function unsplitItem(row: Pick<Transaction, 'id' | 'amount'>, held: readonly TransactionItem[]): TransactionItem {
  return wholeItemOf(row, {
    category: mainCategoryOf(held),
    note: largestItem(held)?.note ?? '',
    link: linkOfItems(held),
    labels: labelsOf(held),
    ruleLabels: ruleLabelsOf(held),
    event: eventOfLargest(held),
    countsUnder: payeeOfAll(held),
  })
}

/**
 * Takes the row's parts out, with the receipt that split it when one did, which leaves one item under its main category. A photo
 * kept on Drive stays there.
 */
export function removeSplitOf(unit: UnitOfWork, records: EntryRecords, row: Transaction): void {
  writeRows(unit, records, [{ before: row, after: row, items: [unsplitItem(row, heldItemsOf(records)(row))] }])
  removeReceiptsOf(unit, records, [row])
}

function removeReceiptsOf(unit: UnitOfWork, records: Pick<SpendingRecords, 'receipts'>, rows: readonly Pick<Transaction, 'id'>[]): void {
  const ids = new Set(rows.map((row) => row.id))
  recordsOf(records.receipts)
    .filter((receipt) => receipt.transaction !== null && ids.has(receipt.transaction))
    .forEach((receipt) => unit.of(RECEIPT_WRITES).remove(receipt))
}
