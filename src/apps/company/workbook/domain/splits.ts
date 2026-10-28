import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import { ownerPartKey } from '../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import type { Bucket } from './bucket'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Transaction } from './workbook'

/**
 * What finds the bank row a split belongs to: its day, its account, and its amount and balance.
 * The balance chain makes the four unique, since no row moves nothing.
 */
export interface SplitKey {
  readonly date: CivilDate
  readonly account: string
  readonly rowAmount: Money
  readonly rowBalance: Money
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
export function partOrder(earlier: SplitPart, later: SplitPart): number {
  return Math.abs(later.amount) - Math.abs(earlier.amount) || naturalOrder(earlier.category, later.category) || naturalOrder(earlier.note, later.note)
}

export function splitKeyOf(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>): SplitKey {
  return { date: row.date, account: row.account, rowAmount: row.amount, rowBalance: row.balance }
}

export function holdsSplitKey(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>, key: SplitKey): boolean {
  return row.date === key.date && row.account === key.account && row.amount === key.rowAmount && row.balance === key.rowBalance
}

/**
 * The ledger with each split row replaced, where it stood, by its parts. A part keeps the bank
 * row's day, account, balance, booking order and text, and takes its own amount, category and share, so
 * every figure counts it as a row of its own.
 */
export function splitLedger(transactions: readonly Transaction[], splits: readonly LedgerSplit[]): readonly Transaction[] {
  if (splits.length === 0) {
    return transactions
  }
  const splitOf = new Map(splits.map((split) => [split.row.id, split]))
  return transactions.flatMap((row) => {
    const split = splitOf.get(row.id)
    if (split === undefined) {
      return [row]
    }
    return split.parts.map(
      (part, index): Transaction => ({
        ...row,
        amount: part.amount,
        category: part.category,
        family: part.family,
        bucket: part.bucket,
        ownerShare: part.ownerShare,
        split: { whole: row, index, count: split.parts.length, note: part.note, id: part.id },
      }),
    )
  })
}

/** A key for a row as a screen lists it: the bank row's, or for a part of a split row the part's own, with the owner's part of a shared row marked. */
export function listedRowKey(row: Pick<Transaction, 'id' | 'split' | 'ownerPart'>): string {
  return ownerPartKey(row.split?.id ?? row.id, row.ownerPart)
}
