import { negateMoney } from '../../../shared/money/money'
import { advanceKindOf } from '../../workbook/domain/workbook'
import type { OwnerAdvance, OwnerAdvanceKind, Transaction } from '../../workbook/domain/workbook'
import { OWNER_COUNTERPARTY } from './filterTransactions'

/** A booked bank entry as Transactions lists it. */
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
  /** What the row is badged as, by its kind. */
  readonly label: string
}

const ADVANCE_LABELS: Readonly<Record<OwnerAdvanceKind, string>> = {
  'paid-by-owner': 'Owner advance',
  'private-share': 'Private share',
}

export type ListedRow = ListedBankRow | ListedAdvanceRow

/** The bank rows and the advances as one list, in the order given. */
export function listedRows(transactions: readonly Transaction[], advances: readonly OwnerAdvance[]): ListedRow[] {
  return [
    ...transactions.map((transaction): ListedBankRow => ({ ...transaction, kind: 'bank', key: `ledger:${transaction.sheetRow}` })),
    ...advances.map(
      (advance): ListedAdvanceRow => ({
        kind: 'owner-advance',
        key: `owner-advances:${advance.sheetRow}`,
        advance,
        label: ADVANCE_LABELS[advanceKindOf(advance)],
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

/** Booking order: by date, then bank rows in the order the bank booked them, then advances in tab order. */
export function inBookingOrder(earlier: ListedRow, later: ListedRow): number {
  const advancesLast = Number(earlier.kind === 'owner-advance') - Number(later.kind === 'owner-advance')
  return earlier.date.localeCompare(later.date) || advancesLast || positionOf(earlier) - positionOf(later)
}

function positionOf(row: ListedRow): number {
  return row.kind === 'bank' ? row.sequence : row.advance.sheetRow
}
