import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import { ownerPartKey } from '../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import type { Bucket } from './bucket'
import { LEDGER_RECORDS, SPLIT_PART_RECORDS } from './coreKinds'
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
 * The id of the one part a bank row that is not split stands for, which its first part keeps when it is split, or null for a row
 * with no row id yet.
 */
export function wholeRowPartId(row: Pick<Transaction, 'rowId'>): RecordId | null {
  return row.rowId === null ? null : recordIdOf(SPLIT_PART_RECORDS, row.rowId)
}

/** The id of the one item a bank row that is not split stands for: the one its row id makes, or for a row with none yet one its own key makes. */
export function wholeItemId(row: Pick<Transaction, 'id' | 'rowId'>): RecordId {
  return wholeRowPartId(row) ?? recordIdOf(SPLIT_PART_RECORDS, keyOfRecordId(LEDGER_RECORDS, row.id))
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
