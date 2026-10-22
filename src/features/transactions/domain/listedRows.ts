import { negateMoney } from '../../../shared/money/money'
import type { RecordId } from '../../workbook/domain/recordId'
import { listedRowKey } from '../../workbook/domain/splits'
import { ownerAdvanceOrder } from '../../workbook/domain/workbook'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'
import { OWNER_COUNTERPARTY } from './filterTransactions'

/** A booked bank entry as Transactions lists it, or one part of a split entry. */
export interface ListedBankRow extends Transaction {
  readonly kind: 'bank'
  /** Unique among the rows listed. */
  readonly key: string
}

/** A row of the owner-advances tab, listed as what it books: no bank account, the owner as counterparty. */
export interface ListedAdvanceRow extends Pick<Transaction, 'date' | 'amount' | 'category' | 'family' | 'bucket' | 'counterparty' | 'counterpartyIban' | 'description'> {
  readonly kind: 'owner-advance'
  readonly key: string
  readonly advance: OwnerAdvance
}

export type ListedRow = ListedBankRow | ListedAdvanceRow

/** What an owner advance is badged as on Transactions. */
export const OWNER_ADVANCE_LABEL = 'Owner advance'

/** The bank rows and the advances as one list, in the order given. */
export function listedRows(transactions: readonly Transaction[], advances: readonly OwnerAdvance[]): ListedRow[] {
  return [
    ...transactions.map((transaction): ListedBankRow => ({ ...transaction, kind: 'bank', key: listedRowKey(transaction) })),
    ...advances.map(
      (advance): ListedAdvanceRow => ({
        kind: 'owner-advance',
        key: advance.id,
        advance,
        date: advance.date,
        amount: negateMoney(advance.amount),
        category: advance.category,
        family: advance.family,
        bucket: advance.bucket,
        counterparty: OWNER_COUNTERPARTY,
        counterpartyIban: '',
        description: advance.description,
      }),
    ),
  ]
}

/** A listed row, or the bank row as booked above the parts of it that are listed. */
export type ListedEntry =
  | { readonly kind: 'row'; readonly row: ListedRow }
  | {
      readonly kind: 'split'
      readonly key: string
      readonly whole: Transaction
      /** How many parts the row has, listed or not. */
      readonly count: number
      /** The parts the filters select, larger first. */
      readonly parts: readonly ListedBankRow[]
    }

/**
 * The rows with each split bank row heading its parts. The heading stands where the first of its
 * listed parts would, and the parts follow it larger first, so a sort by amount
 * still keeps a payment's parts together.
 */
export function withSplitHeadings(rows: readonly ListedRow[]): ListedEntry[] {
  const partsOf = new Map<RecordId, ListedBankRow[]>()
  for (const row of rows) {
    if (row.kind === 'bank' && row.split !== undefined) {
      partsOf.set(row.id, [...(partsOf.get(row.id) ?? []), row])
    }
  }
  const headed = new Set<RecordId>()
  return rows.flatMap((row): ListedEntry[] => {
    if (row.kind !== 'bank' || row.split === undefined) {
      return [{ kind: 'row', row }]
    }
    if (headed.has(row.id)) {
      return []
    }
    headed.add(row.id)
    const parts = [...partsOf.get(row.id)!].sort((earlier, later) => earlier.split!.index - later.split!.index)
    return [{ kind: 'split', key: `split:${row.id}`, whole: row.split.whole, count: row.split.count, parts }, ...parts.map((part): ListedEntry => ({ kind: 'row', row: part }))]
  })
}

/** Booking order: by date, then bank rows in the order the bank booked them, then advances in their own order. */
export function inBookingOrder(earlier: ListedRow, later: ListedRow): number {
  return earlier.date.localeCompare(later.date) || sameDayOrder(earlier, later)
}

function sameDayOrder(earlier: ListedRow, later: ListedRow): number {
  if (earlier.kind === 'bank' && later.kind === 'bank') {
    return earlier.sequence - later.sequence
  }
  if (earlier.kind === 'owner-advance' && later.kind === 'owner-advance') {
    return ownerAdvanceOrder(earlier.advance, later.advance)
  }
  return earlier.kind === 'bank' ? -1 : 1
}
