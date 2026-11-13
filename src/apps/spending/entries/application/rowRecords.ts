import { refusedOnAccount } from '../domain/bankRows'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isBeforeItems, itemOfWaitingLine, itemsOfStoredRow, storedBeforeItems, plainLineOf } from '../../workbook/domain/beforeItems'
import type { StoredLine } from '../../workbook/domain/beforeItems'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS, ITEM_RECORDS, LINE_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { BLANK_CELLS, storedRowOf } from '../../workbook/domain/transaction'
import type { StoredRow, Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { words } from '../../workbook/domain/words'
import type { Repository, UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf, sameRecord } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import { pickedEdits } from '../../../../shared/storage/domain/writeRules'
import type { FreshRecords, KindChange, WriteRules } from '../../../../shared/storage/domain/writeRules'

/**
 * An entry may be a transfer's leg, which its other leg names back, so a write keeps both or neither. A row a statement brought
 * stays on its account, and a row a person made goes on no account the bank fills. A row split into parts keeps the amount its
 * parts add up to, and one a bank row on hold looks like stays.
 */
export const TRANSACTION_WRITES: WriteRules<StoredRow> = {
  kind: TRANSACTION_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TRANSACTION_RECORDS, read, records).readings.transactions,
  refusals: (change, fresh, after) => [
    ...pickedEdits(change, (fields) => ({ account: textOf(fields.account), importKey: textOf(fields.import_key) })).flatMap(({ before, after: changed }) =>
      before !== null && changed !== null && before.importKey !== '' && before.account !== changed.account ? [words.accountOfStatementRow] : [],
    ),
    ...byHandOnBankAccounts(change, after),
    ...dependentRefusals(['transactions', 'receipts', 'lines', 'items', 'held'], fresh, after),
  ],
}

/** Each row the write puts on an account the bank fills, newly or by moving it there, that a person made. */
function byHandOnBankAccounts(change: KindChange<StoredRow>, after: FreshRecords): readonly string[] {
  const accounts = new Map(recordsOf(after.of(ACCOUNT_RECORDS)).map((account) => [account.id, account]))
  return change.edits.flatMap((edit) => {
    if (edit.after === null || !('record' in edit.after)) return []
    const row = edit.after.record
    const before = edit.before !== null && 'record' in edit.before ? edit.before.record : null
    const account = accounts.get(row.account)
    if (account === undefined || before?.account === row.account || !refusedOnAccount(row, account)) return []
    return [words.byHandOnBankAccount(account.name)]
  })
}

/** The items of an entry add up to its amount, so a write changes them together or not at all, and the entry keeps at least one. */
export const ITEM_WRITES: WriteRules<TransactionItem> = {
  kind: ITEM_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(ITEM_RECORDS, read, records).readings.items,
  refusals: (_change, fresh, after) => dependentRefusals(['transactions', 'items'], fresh, after),
}

/** The lines of a file from before items add up to their entry's amount as items do. */
export const LINE_WRITES: WriteRules<StoredLine> = {
  kind: LINE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LINE_RECORDS, read, records).readings.lines,
  refusals: (_change, fresh, after) => dependentRefusals(['lines'], fresh, after),
}

/** One row a write adds, changes or removes. A row added, or whose items change, gives every item it then has. A change that leaves them out keeps them. */
export interface RowWrite {
  readonly before: Transaction | null
  readonly after: Transaction | null
  readonly items?: readonly TransactionItem[]
}

/** Every line a receipt that waits for the bank's row then has, none once it is gone. */
export interface WaitingLines {
  readonly receipt: RecordId
  readonly lines: readonly TransactionItem[]
}

type Part = { readonly id: RecordId; readonly transaction: RecordId | null; readonly receipt: RecordId | null }

/** A kind's parts as the file holds them, by row, by waiting receipt and by id. */
interface StoredParts<P extends Part> {
  readonly ofRow: (row: RecordId) => readonly P[]
  readonly ofWaiting: (receipt: RecordId) => readonly P[]
  readonly byId: ReadonlyMap<RecordId, P>
}

function partsByOwner<P extends Part>(read: RecordsRead<P>): StoredParts<P> {
  const ofRow = new Map<RecordId, P[]>()
  const ofWaiting = new Map<RecordId, P[]>()
  for (const part of recordsOf(read)) {
    if (part.transaction !== null) ofRow.set(part.transaction, [...(ofRow.get(part.transaction) ?? []), part])
    else if (part.receipt !== null) ofWaiting.set(part.receipt, [...(ofWaiting.get(part.receipt) ?? []), part])
  }
  return { ofRow: (row) => ofRow.get(row) ?? [], ofWaiting: (receipt) => ofWaiting.get(receipt) ?? [], byId: new Map(recordsOf(read).map((part) => [part.id, part])) }
}

type StoredEntries = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/** The file's rows, lines and items by owner, worked out once per read, since an import writes thousands of rows. */
interface EntryIndex {
  readonly beforeItems: boolean
  readonly rows: ReadonlyMap<RecordId, StoredRow>
  readonly lines: StoredParts<StoredLine>
  readonly items: StoredParts<TransactionItem>
}

const INDEXES = new WeakMap<RecordsRead<StoredRow>, { readonly lines: RecordsRead<StoredLine>; readonly items: RecordsRead<TransactionItem>; readonly index: EntryIndex }>()

function indexOf(records: StoredEntries): EntryIndex {
  const held = INDEXES.get(records.transactions)
  if (held !== undefined && held.lines === records.lines && held.items === records.items) return held.index
  const index: EntryIndex = {
    beforeItems: isBeforeItems(records),
    rows: new Map(recordsOf(records.transactions).map((row) => [row.id, row])),
    lines: partsByOwner(records.lines),
    items: partsByOwner(records.items),
  }
  INDEXES.set(records.transactions, { lines: records.lines, items: records.items, index })
  return index
}

/** The items each row holds in the file, in either shape: made of its cells or lines in a file from before items. */
export function heldItemsOf(records: StoredEntries): (row: Pick<Transaction, 'id'>) => readonly TransactionItem[] {
  const index = indexOf(records)
  return (row) => {
    if (!index.beforeItems) return index.items.ofRow(row.id)
    const stored = index.rows.get(row.id)
    return stored === undefined ? [] : itemsOfStoredRow(stored, index.lines.ofRow(row.id))
  }
}

/** The lines each receipt that waits for the bank's row holds in the file, as items, in either shape. */
export function waitingItemsOf(records: StoredEntries): (receipt: RecordId) => readonly TransactionItem[] {
  const index = indexOf(records)
  return (receipt) => (index.beforeItems ? index.lines.ofWaiting(receipt).map(itemOfWaitingLine) : index.items.ofWaiting(receipt))
}

/** Each part the write leaves changed in place or added, and each part it found that it leaves out removed. */
function writeParts<P extends Part>(records: Repository<P>, stored: StoredParts<P>, found: readonly P[], left: readonly P[]): void {
  const leftIds = new Set(left.map((part) => part.id))
  for (const part of left) {
    const held = stored.byId.get(part.id)
    if (held === undefined) records.add(part)
    else if (!sameRecord(held, part)) records.change(held, part)
  }
  const foundOnce = new Map([...found, ...left.flatMap((part) => stored.byId.get(part.id) ?? [])].map((part) => [part.id, part]))
  for (const part of foundOnce.values()) {
    if (!leftIds.has(part.id)) records.remove(part)
  }
}

/**
 * Writes rows with their items in the shape the file holds them, the one place that knows both. A file moved to items gets
 * item records and rows without a category, note or link. A file from before items keeps those on a row not split and lines
 * for a split one, as `storedBeforeItems` says, and stays in that shape until the person moves it.
 */
export function writeRows(unit: UnitOfWork, records: StoredEntries, rows: readonly RowWrite[], waiting: readonly WaitingLines[] = []): void {
  const index = indexOf(records)
  const entries = unit.of(TRANSACTION_WRITES)
  const storedRowFor = (row: Transaction): StoredRow => index.rows.get(row.id) ?? storedRowOf(row, BLANK_CELLS)
  if (index.beforeItems) {
    const found: StoredLine[] = waiting.flatMap(({ receipt }) => index.lines.ofWaiting(receipt))
    const left: StoredLine[] = waiting.flatMap(({ lines }) => lines.map(plainLineOf))
    for (const { before, after, items } of rows) {
      const stored = before === null ? null : { row: storedRowFor(before), lines: index.lines.ofRow(before.id) }
      if (stored !== null) found.push(...stored.lines)
      if (after === null) {
        if (stored !== null) entries.remove(stored.row)
        continue
      }
      const written = storedBeforeItems(after, items ?? (stored === null ? [] : itemsOfStoredRow(stored.row, stored.lines)), stored)
      if (stored === null) entries.add(written.row)
      else entries.change(stored.row, written.row)
      left.push(...written.lines)
    }
    writeParts(unit.of(LINE_WRITES), index.lines, found, left)
    return
  }
  const found: TransactionItem[] = waiting.flatMap(({ receipt }) => index.items.ofWaiting(receipt))
  const left: TransactionItem[] = waiting.flatMap(({ lines }) => lines)
  for (const { before, after, items } of rows) {
    if (before !== null && (after === null || items !== undefined)) found.push(...index.items.ofRow(before.id))
    if (after === null) {
      if (before !== null) entries.remove(storedRowFor(before))
      continue
    }
    if (before === null) entries.add(storedRowOf(after, BLANK_CELLS))
    else entries.change(storedRowFor(before), storedRowOf(after, BLANK_CELLS))
    left.push(...(items ?? []))
  }
  writeParts(unit.of(ITEM_WRITES), index.items, found, left)
}

/**
 * Moves a file from before items to items in one write with Undo: each row loses its own category, note and link, each line
 * leaves, and every row and waiting receipt gets the items the reader made of them, under the same keys. It repairs nothing,
 * so the person moves a file only once `moveBlockers` finds nothing.
 */
export function moveToItems(unit: UnitOfWork, book: Pick<SpendingBook, 'stored' | 'items'>): void {
  const entries = unit.of(TRANSACTION_WRITES)
  recordsOf(book.stored.transactions).forEach((row) => entries.change(row, storedRowOf(row, BLANK_CELLS)))
  recordsOf(book.stored.lines).forEach((line) => unit.of(LINE_WRITES).remove(line))
  book.items.forEach((item) => unit.of(ITEM_WRITES).add(item))
}
