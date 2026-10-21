import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import type { Bucket } from './bucket'
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
  /** The part's row on the splits tab, or null for a private share still on the owner-advances tab. */
  readonly sheetRow: number | null
}

/** A bank row and the parts that count in its place, which add up to it. */
export interface LedgerSplit {
  readonly row: Transaction
  /** In the order of the splits tab. */
  readonly parts: readonly SplitPart[]
}

export function splitKeyOf(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>): SplitKey {
  return { date: row.date, account: row.account, rowAmount: row.amount, rowBalance: row.balance }
}

export function holdsSplitKey(row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>, key: SplitKey): boolean {
  return row.date === key.date && row.account === key.account && row.amount === key.rowAmount && row.balance === key.rowBalance
}

/**
 * The ledger with each split row replaced, where it stood, by its parts. A part keeps the bank
 * row's day, account, balance, booking order and text, and takes its own amount and category, so
 * every figure counts it as a row of its own.
 */
export function splitLedger(transactions: readonly Transaction[], splits: readonly LedgerSplit[]): readonly Transaction[] {
  if (splits.length === 0) {
    return transactions
  }
  const splitOf = new Map(splits.map((split) => [split.row.sheetRow, split]))
  return transactions.flatMap((row) => {
    const split = splitOf.get(row.sheetRow)
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
        split: { whole: row, index, count: split.parts.length, note: part.note, sheetRow: part.sheetRow },
      }),
    )
  })
}

/** A key for a row as a screen lists it, which tells the parts of one bank row apart. */
export function listedRowKey(row: Pick<Transaction, 'sheetRow' | 'split'>): string {
  return row.split === undefined ? String(row.sheetRow) : `${row.sheetRow}.${row.split.index}`
}
