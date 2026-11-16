import type { EntrySplit } from '../domain/entrySplit'
import { CATEGORY_WRITES } from '../../categories/application/categoryWrites'
import { eventOfLargest, labelsOf } from '../../workbook/domain/carriedChoices'
import { linkedEntry } from '../../links/domain/instalmentSplit'
import type { LinkPlace, LinkedEntry } from '../../links/domain/instalmentSplit'
import type { LinkTarget } from '../../links/domain/linkTarget'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { heldItemsOf, writeRows } from './rowRecords'
import type { RowWrite } from './rowRecords'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { EventChoice } from '../../workbook/domain/event'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { isSplit, largestItem, linkOfItems, linkedItems, wholeItemOf } from '../../workbook/domain/rowItems'
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

/** The rows and items an entry write reads of the file. */
type EntryRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>

/** What you type for an entry not split: its category, or none while it waits on review, its note, its labels and its event. */
export interface TypedFiling {
  readonly category: RecordId | null
  readonly note: string
  readonly labels: readonly RecordId[]
  /** Left out, the money joins an event by its row's day. */
  readonly event?: EventChoice
}

/** A new typed entry, its text trimmed, with an id of its own and one item with all of its money. */
export function newEntry(entry: Pick<Transaction, 'account' | 'date' | 'amount' | 'payee'> & TypedFiling): ItemizedRow {
  const { category, note, labels, event, ...typed } = entry
  const row: Transaction = { ...typed, ...NO_BANK_FACTS, payee: entry.payee.trim(), source: 'typed', pair: null, categorisedBy: 'person', id: recordIdOf(TRANSACTION_RECORDS, newRecordId()) }
  return { row, items: [wholeItemOf(row, { category, note: note.trim(), link: null, labels, ...(event === undefined ? {} : { event }) })] }
}

/**
 * What you typed over a row on the file. It keeps its id, its source and what the bank said, so a later statement still skips
 * it. A row not split keeps its one item's id and link and takes the typed amount, category, note, labels and event, and a
 * category you changed is yours from then on. A split row keeps its items, each with the labels and event of the typed part of
 * its id, and a receipt's line takes that part's category and note too, while its amount stays the receipt's.
 */
export function retypedEntry(before: ItemizedRow, typed: ItemizedRow): ItemizedRow {
  const { description, counterpartyIban, importKey, statement, movedAt, pocket, id, source } = before.row
  const [held] = before.items
  const [filing] = typed.items
  const whole = held !== undefined && filing !== undefined && !isSplit(before.items)
  const typedParts = new Map(typed.items.map((part) => [part.id, part]))
  const parts = before.items.map((part) => {
    const typedPart = typedParts.get(part.id)
    const refiled = part.receipt === null || typedPart === undefined ? {} : { category: typedPart.category ?? part.category, note: typedPart.note }
    return { ...part, labels: typedPart?.labels ?? part.labels, event: typedPart?.event ?? part.event, ...refiled }
  })
  const filedAnew = whole ? held.category !== filing.category : parts.some((part, place) => part.category !== before.items[place]?.category)
  const row: Transaction = { ...typed.row, description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, categorisedBy: filedAnew ? 'person' : before.row.categorisedBy }
  if (whole) return { row, items: [{ ...held, amount: row.amount, category: filing.category, note: filing.note, labels: filing.labels, event: filing.event }] }
  return { row, items: parts }
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

/** The entry typed over a row on the file, or added when there is none. A transfer's other leg goes, since the row is a plain entry now. */
export function writeEntry(unit: UnitOfWork, records: EntryRecords, before: ItemizedRow | null, entry: ItemizedRow, otherLeg: Transaction | null): void {
  if (before === null) {
    writeRows(unit, records, [added(entry)])
    return
  }
  writeRows(unit, records, [changed(before, retypedEntry(before, entry)), ...(otherLeg === null ? [] : [{ before: otherLeg, after: null }])])
}

/** Both legs of a transfer in one write: added, a plain row turned into the leg its money already is, or written over the transfer it was, each leg keeping its labels. */
export function writeTransfer(unit: UnitOfWork, records: EntryRecords, before: ItemizedRow | null, legs: readonly [ItemizedRow, ItemizedRow] | null, typed: readonly [ItemizedRow, ItemizedRow]): void {
  const [outLeg, inLeg] = typed
  if (before === null) {
    writeRows(unit, records, [added(outLeg), added(inLeg)])
  } else if (legs === null) {
    const { kept, added: joined } = transferOver(before, typed)
    writeRows(unit, records, [changed(before, kept), added(joined)])
  } else {
    const [oldOut, oldIn] = legs
    const out = legOver(oldOut, outLeg)
    const into = legOver(oldIn, inLeg)
    writeRows(unit, records, [changed(oldOut, { ...out, row: { ...out.row, pair: oldIn.row.id } }), changed(oldIn, { ...into, row: { ...into.row, pair: oldOut.row.id } })])
  }
}

/**
 * The entry linked to the record in Loans it is, in one write, with the categories it needs added in the same write. An
 * instalment splits it as `linkFiling` says, and any other link leaves each item as it is with the link on it.
 */
export function linkEntry(unit: UnitOfWork, records: EntryRecords, row: Transaction, target: LinkTarget, place: LinkPlace, newKey: () => string = newRecordId): LinkedEntry {
  const receipt = recordsOf(records.receipts).some((held) => held.transaction === row.id)
  const linked = linkedEntry({ row, items: heldItemsOf(records)(row) }, target, { ...place, receipt }, newKey)
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

/** Takes the link off every item of the entry. Its parts stay as they are, so principal an instalment split off stays principal. */
export function unlinkEntry(unit: UnitOfWork, records: EntryRecords, row: Transaction): void {
  writeRows(unit, records, [{ before: row, after: row, items: linkedItems(heldItemsOf(records)(row), null) }])
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
 * others are added, and a held part no new part names goes.
 */
export function writeEntrySplit(unit: UnitOfWork, records: EntryRecords, { row, before, parts }: EntrySplit): void {
  writeRows(unit, records, [{ before: before.row, after: row, items: parts }])
}

/** The one item a split row stands for again: all of its money under the category most of it was in, with the note and event choice of its largest part, its link and every label of its parts. */
export function unsplitItem(row: Pick<Transaction, 'id' | 'amount'>, held: readonly TransactionItem[]): TransactionItem {
  return wholeItemOf(row, { category: mainCategoryOf(held), note: largestItem(held)?.note ?? '', link: linkOfItems(held), labels: labelsOf(held), event: eventOfLargest(held) })
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
