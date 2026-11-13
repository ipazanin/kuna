import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { Money } from '../../../../shared/money/money'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import { ownerPartKey } from '../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import type { Bucket } from './bucket'
import { ITEM_RECORDS, LEDGER_RECORDS } from './coreKinds'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Transaction } from './workbook'

/**
 * What finds the bank row a split belongs to: the row's id, or for a part stored before the row had one its day, its account,
 * and its amount and balance. The balance chain makes the four unique, since no row moves nothing. A part keeps the four beside
 * the id, as the row stood when the part was written.
 */
export interface SplitKey {
  readonly date: CivilDate
  readonly account: string
  readonly rowAmount: Money
  readonly rowBalance: Money
  /** The bank row's `rowId`, or null on a part written before the row had one. */
  readonly rowId: string | null
}

/** One part of a split row: what of the payment counts in which category. */
export interface SplitPart {
  /** The same sign as the row. */
  readonly amount: Money
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly note: string
  readonly ownerShare: OwnerShare | null
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

/** A part of a row as the books store it, which a write to the row's items keeps, changes or removes by its id. */
export type StoredItem = Pick<SplitPart, 'id' | 'amount' | 'category' | 'note' | 'ownerShare'>

/** What the books hold of a row's split, which a write to the row's items replaces. */
export interface StoredSplit {
  /** The parts that can be read, larger first. None for a row of one item. */
  readonly parts: readonly StoredItem[]
  /** True when the row has parts but none of them counts, since the guards refused them. */
  readonly refused: boolean
  /** How many records of the row's parts cannot be read, which keep any split of the row from counting until they are fixed. */
  readonly unreadable: number
}

/** What the books hold of a row of one item: no split. */
export const NOTHING_STORED: StoredSplit = { parts: [], refused: false, unreadable: 0 }

/** A bank row and the parts that count in its place, which add up to it. */
export interface LedgerSplit {
  readonly row: Transaction
  /** Larger first, as `partOrder` puts them. */
  readonly parts: readonly SplitPart[]
}

/** Parts larger first, then by category and note, so a part's number does not hang on where its row sits. */
export function partOrder(earlier: Pick<SplitPart, 'amount' | 'category' | 'note'>, later: Pick<SplitPart, 'amount' | 'category' | 'note'>): number {
  return Math.abs(later.amount) - Math.abs(earlier.amount) || naturalOrder(earlier.category, later.category) || naturalOrder(earlier.note, later.note)
}

/**
 * The id of the one item of a bank row that is not split: the one its row id makes, or for a row with none yet one its own key
 * makes. A split's first part keeps it, and the one item left when a split comes off takes it again.
 */
export function wholeItemId(row: Pick<Transaction, 'id' | 'rowId'>): RecordId {
  return recordIdOf(ITEM_RECORDS, row.rowId ?? keyOfRecordId(LEDGER_RECORDS, row.id))
}

/** A bank row's items: the parts of its split, or while it has none the one item the row stands for, with its whole amount, category and share and no note. */
export function itemsOfRow(row: Transaction, split: LedgerSplit | undefined): readonly SplitPart[] {
  if (split !== undefined) return split.parts
  return [{ amount: row.amount, category: row.category, family: row.family, bucket: row.bucket, note: '', ownerShare: row.ownerShare, id: wholeItemId(row) }]
}

/** The items of any row by these splits, each split found by its row. */
export function rowItemsOf(splits: readonly LedgerSplit[]): (row: Transaction) => readonly SplitPart[] {
  const splitOf = new Map(splits.map((split) => [split.row.id, split]))
  return (row) => itemsOfRow(row, splitOf.get(row.id))
}

/** The item of the category most of the row's money is in, the first of them in item order. */
export function mainItemOf(items: readonly SplitPart[]): SplitPart {
  const category = mainCategoryOf(items)
  return items.find((item) => item.category === category)!
}

/** The row as its items file it whole: as its one item, or for a row of several as the item of the category most of its money is in. */
export function rowFiledAs(row: Transaction, items: readonly SplitPart[]): Transaction {
  const main = mainItemOf(items)
  return { ...row, category: main.category, family: main.family, bucket: main.bucket, ownerShare: main.ownerShare }
}

/** The rows a rule may file: those of one item, since a row of several says by its split where each part of its money goes. */
export function rowsOfOneItem<Row extends Pick<Transaction, 'id'>>(transactions: readonly Row[], splits: readonly Pick<LedgerSplit, 'row'>[]): Row[] {
  const split = new Set(splits.map((held) => held.row.id))
  return transactions.filter((row) => !split.has(row.id))
}

/** The key a part of this row is written with. */
export function splitKeyOf(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance' | 'rowId'>): SplitKey {
  return { date: row.date, account: row.account, rowAmount: row.amount, rowBalance: row.balance, rowId: row.rowId }
}

/** The ledger rows a split's key finds: those with its row id, or without one those with its day, account, amount and balance. */
export function rowsOfSplitKey<Row extends Pick<Transaction, 'date' | 'account' | 'amount' | 'balance' | 'rowId'>>(transactions: readonly Row[], key: SplitKey): Row[] {
  return transactions.filter((row) =>
    key.rowId === null ? row.date === key.date && row.account === key.account && row.amount === key.rowAmount && row.balance === key.rowBalance : row.rowId === key.rowId,
  )
}

/**
 * The ledger with each row as its items, where it stood. A row of one item stays as it is. A row of several becomes one row per
 * item, which keeps the bank row's day, account, balance, booking order and text, and takes the item's own amount, category and
 * share, so every figure counts it as a row of its own. A part already in the ledger stays as it is, so splitting a split ledger
 * again changes nothing.
 */
export function splitLedger(transactions: readonly Transaction[], splits: readonly LedgerSplit[]): readonly Transaction[] {
  if (splits.length === 0) {
    return transactions
  }
  const itemsOf = rowItemsOf(splits)
  return transactions.flatMap((row) => {
    const items = row.split === undefined ? itemsOf(row) : []
    if (items.length < 2) {
      return [row]
    }
    return items.map((item, index): Transaction => ({
      ...row,
      amount: item.amount,
      category: item.category,
      family: item.family,
      bucket: item.bucket,
      ownerShare: item.ownerShare,
      split: { whole: row, index, count: items.length, note: item.note, id: item.id },
    }))
  })
}

/** A key for a row as a screen lists it: the bank row's, or for a part of a split row the part's own, with the owner's part of a shared row marked. */
export function listedRowKey(row: Pick<Transaction, 'id' | 'split' | 'ownerPart'>): string {
  return ownerPartKey(row.split?.id ?? row.id, row.ownerPart)
}
