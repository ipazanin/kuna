import { ITEM_RECORDS, LINE_RECORDS } from './spendingKinds'
import { isSplit, largestItem, linkOfItems, rowItemsOf, wholeItemOf, wholeRowItemId } from './rowItems'
import type { SpendingBook } from './readSpendingBook'
import { storedRowOf } from './transaction'
import type { RowCells, StoredRow, Transaction } from './transaction'
import type { TransactionItem } from './transactionItem'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { sameRecord, storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'

/** A part of an entry as a file from before items keeps it: a `line` with its words in `text`, its entry's link on the entry. */
export interface StoredLine extends Omit<TransactionItem, 'note' | 'link'> {
  readonly text: string
}

/** How the row's note and a line's words join on the line that carries the note. */
const NOTE_JOIN = ' · '

/** What a file stores of rows, lines and items. */
export interface StoredEntries {
  readonly transactions: RecordsRead<unknown>
  readonly lines: RecordsRead<unknown>
  readonly items: RecordsRead<unknown>
}

/** Whether a file is from before items: it holds rows or lines and no item. A new or empty file is in the shape with items. */
export function isBeforeItems({ transactions, lines, items }: StoredEntries): boolean {
  return storedOf(items).length === 0 && storedOf(transactions).length + storedOf(lines).length > 0
}

/** The id of the item a line becomes, under the same key. */
export function itemIdOfLine(id: RecordId): RecordId {
  return recordIdOf(ITEM_RECORDS, keyOfRecordId(LINE_RECORDS, id))
}

function lineIdOfItem(id: RecordId): RecordId {
  return recordIdOf(LINE_RECORDS, keyOfRecordId(ITEM_RECORDS, id))
}

function joinedNote(rowNote: string, text: string): string {
  return [rowNote, text].filter((words) => words !== '').join(NOTE_JOIN)
}

function itemOfLine(line: StoredLine, note: string, link: TransactionItem['link']): TransactionItem {
  const { id, transaction, receipt, printed, amount, category } = line
  return { id: itemIdOfLine(id), transaction, receipt, printed, note, amount, category, link }
}

function lineOfItem(item: TransactionItem, text: string): StoredLine {
  const { id, transaction, receipt, printed, amount, category } = item
  return { id: lineIdOfItem(id), transaction, receipt, printed, text, amount, category }
}

/**
 * A row's items as a file from before items holds them: its lines, with the row's note in front of the words of the largest and
 * the row's link on each, or while it has none the one item with all of its money under the row's own category, note and link.
 */
export function itemsOfStoredRow(row: StoredRow, lines: readonly StoredLine[]): readonly TransactionItem[] {
  if (lines.length === 0) return [wholeItemOf(row, row)]
  const carrier = largestItem(lines)
  return lines.map((line) => itemOfLine(line, line === carrier ? joinedNote(row.note, line.text) : line.text, row.link))
}

/** A line of a receipt that waits for the bank's row, as an item. */
export function itemOfWaitingLine(line: StoredLine): TransactionItem {
  return itemOfLine(line, line.text, null)
}

/** An item as a line of a file from before items, its note as the line's words, as a waiting receipt's line is stored. */
export function plainLineOf(item: TransactionItem): StoredLine {
  return lineOfItem(item, item.note)
}

/** A row and its lines as a file from before items stores them. */
export interface RowBeforeItems {
  readonly row: StoredRow
  readonly lines: readonly StoredLine[]
}

/**
 * The row with its items as a file from before items stores them, written over the row as it stood, or null for a new row. Items
 * the write left as they were keep the row's cells and lines. One item that is not a receipt's line puts its category, note and
 * link on the row. Several go in lines, with the row under their main category and their link, and the row's note stays on the
 * row while one of them still begins with it.
 */
export function storedBeforeItems(row: Transaction, items: readonly TransactionItem[], before: RowBeforeItems | null): RowBeforeItems {
  const read = before === null ? null : itemsOfStoredRow(before.row, before.lines)
  if (before !== null && sameRecord(items, read)) return { row: storedRowOf(row, before.row), lines: before.lines }
  const [only] = items
  if (only !== undefined && items.length === 1 && only.receipt === null && only.id === wholeRowItemId(row)) {
    const keptNote = before !== null && before.lines.length > 0 && only.note === largestItem(read ?? [])?.note
    return { row: storedRowOf(row, { category: only.category, note: keptNote ? before.row.note : only.note, link: only.link }), lines: [] }
  }
  const rowNote = before?.row.note ?? ''
  const candidates = [largestItem(items), ...items].filter((item): item is TransactionItem => item !== null)
  const carrier = rowNote === '' ? undefined : candidates.find((item) => item.note === rowNote || item.note.startsWith(rowNote + NOTE_JOIN))
  const cells: RowCells = { category: mainCategoryOf(items), note: carrier === undefined ? '' : rowNote, link: linkOfItems(items) }
  const textOf = (item: TransactionItem): string => (item !== carrier ? item.note : item.note.slice(Math.min(item.note.length, rowNote.length + NOTE_JOIN.length)))
  return { row: storedRowOf(row, cells), lines: items.map((item) => lineOfItem(item, textOf(item))) }
}

/** What a move to items would leave behind, which it waits on since it repairs nothing. */
export interface MoveBlockers {
  /** The rows and lines the reader leaves out. */
  readonly leftOut: number
  /** The transfer legs split into parts, which a file moved to items never splits. */
  readonly splitLegs: number
}

/** What keeps a file from before items from moving to items. */
export function moveBlockers(book: Pick<SpendingBook, 'stored' | 'transactions' | 'items' | 'readings'>): MoveBlockers {
  const itemsOf = rowItemsOf(book)
  const rowsLeftOut = storedOf(book.stored.transactions).length - book.transactions.length
  const linesLeftOut = storedOf(book.stored.lines).length - book.readings.lines.facts.length
  return { leftOut: rowsLeftOut + linesLeftOut, splitLegs: book.transactions.filter((row) => row.pair !== null && isSplit(itemsOf(row))).length }
}
