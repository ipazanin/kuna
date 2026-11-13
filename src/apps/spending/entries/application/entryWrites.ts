import type { EntrySplit } from '../domain/entrySplit'
import { RECEIPT_WRITES } from '../../receipts/application/receiptRecords'
import { heldItemsOf, writeRows } from './rowRecords'
import type { RowWrite } from './rowRecords'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { isSplit, largestItem, linkOfItems, linkedItems, wholeItemOf } from '../../workbook/domain/rowItems'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { PartReplacement } from '../../../../shared/categorising/domain/partReplacements'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

/** The rows and items an entry write reads of the file. */
type EntryRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>

/** What you type for an entry not split: its category, or none while it waits on review, and its note. */
export interface TypedFiling {
  readonly category: RecordId | null
  readonly note: string
}

/** A new typed entry, its text trimmed, with an id of its own and one item with all of its money. */
export function newEntry(entry: Pick<Transaction, 'account' | 'date' | 'amount' | 'payee'> & TypedFiling): ItemizedRow {
  const { category, note, ...typed } = entry
  const row: Transaction = { ...typed, ...NO_BANK_FACTS, payee: entry.payee.trim(), source: 'typed', pair: null, categorisedBy: 'person', id: recordIdOf(TRANSACTION_RECORDS, newRecordId()) }
  return { row, items: [wholeItemOf(row, { category, note: note.trim(), link: null })] }
}

/**
 * What you typed over a row on the file. It keeps its id, its source and what the bank said, so a later statement still skips
 * it. A row not split keeps its one item's id and link and takes the typed amount, category and note, and a category you changed
 * is yours from then on. A split row keeps its items.
 */
export function retypedEntry(before: ItemizedRow, typed: ItemizedRow): ItemizedRow {
  const { description, counterpartyIban, importKey, statement, movedAt, pocket, id, source } = before.row
  const [held] = before.items
  const [filing] = typed.items
  const whole = held !== undefined && filing !== undefined && !isSplit(before.items)
  const filedAnew = whole && held.category !== filing.category
  const row: Transaction = { ...typed.row, description, counterpartyIban, importKey, statement, movedAt, pocket, id, source, categorisedBy: filedAnew ? 'person' : before.row.categorisedBy }
  return { row, items: whole ? [{ ...held, amount: row.amount, category: filing.category, note: filing.note }] : before.items }
}

/**
 * A plain row turned into a transfer: it stays the leg its money already is, so money in stays money in, and the other
 * leg joins it.
 */
export function transferOver(before: ItemizedRow, [outLeg, inLeg]: readonly [ItemizedRow, ItemizedRow]): { readonly kept: ItemizedRow; readonly added: ItemizedRow } {
  const [stays, joins] = before.row.amount < 0 ? [outLeg, inLeg] : [inLeg, outLeg]
  const kept = retypedEntry(before, stays)
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

/** Both legs of a transfer in one write: added, a plain row turned into the leg its money already is, or written over the transfer it was. */
export function writeTransfer(unit: UnitOfWork, records: EntryRecords, before: ItemizedRow | null, legs: readonly [ItemizedRow, ItemizedRow] | null, typed: readonly [ItemizedRow, ItemizedRow]): void {
  const [outLeg, inLeg] = typed
  if (before === null) {
    writeRows(unit, records, [added(outLeg), added(inLeg)])
  } else if (legs === null) {
    const { kept, added: joined } = transferOver(before, typed)
    writeRows(unit, records, [changed(before, kept), added(joined)])
  } else {
    const [oldOut, oldIn] = legs
    const out = retypedEntry(oldOut, outLeg)
    const into = retypedEntry(oldIn, inLeg)
    writeRows(unit, records, [changed(oldOut, { ...out, row: { ...out.row, pair: oldIn.row.id } }), changed(oldIn, { ...into, row: { ...into.row, pair: oldOut.row.id } })])
  }
}

/** Every item of the entry linked to the record in another app it is, or its link taken off for null. It keeps its category. */
export function linkEntry(unit: UnitOfWork, records: EntryRecords, row: Transaction, link: RowLink | null): void {
  writeRows(unit, records, [{ before: row, after: row, items: linkedItems(heldItemsOf(records)(row), link) }])
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
 * others are added, and a held part no new part names goes. Gives what each part replaces.
 */
export function writeEntrySplit(unit: UnitOfWork, records: EntryRecords, { before, row, parts }: EntrySplit): readonly PartReplacement<RecordId>[] {
  writeRows(unit, records, [{ before: before.row, after: row, items: parts }])
  return partReplacements(before.items, parts)
}

/** The one item a split row stands for again: all of its money under the category most of it was in, with the note of its largest part and its link. */
export function unsplitItem(row: Pick<Transaction, 'id' | 'amount'>, held: readonly TransactionItem[]): TransactionItem {
  return wholeItemOf(row, { category: mainCategoryOf(held), note: largestItem(held)?.note ?? '', link: linkOfItems(held) })
}

/**
 * Takes the row's parts out, with the receipt that split it when one did, which leaves one item under its main category. A photo
 * kept on Drive stays there. Gives what that one item replaces.
 */
export function removeSplitOf(unit: UnitOfWork, records: EntryRecords, row: Transaction): readonly PartReplacement<RecordId>[] {
  const held = heldItemsOf(records)(row)
  const whole = unsplitItem(row, held)
  writeRows(unit, records, [{ before: row, after: row, items: [whole] }])
  removeReceiptsOf(unit, records, [row])
  return partReplacements(held, [whole])
}

function removeReceiptsOf(unit: UnitOfWork, records: Pick<SpendingRecords, 'receipts'>, rows: readonly Pick<Transaction, 'id'>[]): void {
  const ids = new Set(rows.map((row) => row.id))
  recordsOf(records.receipts)
    .filter((receipt) => receipt.transaction !== null && ids.has(receipt.transaction))
    .forEach((receipt) => unit.of(RECEIPT_WRITES).remove(receipt))
}
