import { euroRows } from '../../rates/domain/euroRows'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RateBook } from '../../../../shared/money/rateBook'
import { moneyParts } from '../../../../shared/money/decimal'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One part of a counted row: what it is filed under and its share of the row's euros, null while the rates do not reach the row's day. */
export interface CountedPart extends Pick<TransactionItem, 'category' | 'labels' | 'event'> {
  readonly euros: Money | null
}

/** A row as every figure counts it: its day, who it was with, the account it is on and its parts. */
export interface CountedRow {
  readonly day: CivilDate
  readonly payee: string
  /** The other side's IBAN as the transaction holds it, or blank. */
  readonly counterpartyIban: string
  readonly account: RecordId | null
  /** At least one, in the order of the row's items. */
  readonly parts: readonly CountedPart[]
}

/** Each item's share of the row's euros, a discount item's of the other sign, so the shares add up to the row. */
function eurosOfItems({ euros, items }: EuroRow): readonly (Money | null)[] {
  if (euros === null) return items.map(() => null)
  return moneyParts(
    euros,
    items.map((item) => BigInt(item.amount)),
  )
}

export function countedRowOf(row: EuroRow): CountedRow {
  const euros = eurosOfItems(row)
  const { transaction } = row
  return {
    day: transaction.date,
    payee: transaction.payee,
    counterpartyIban: transaction.counterpartyIban,
    account: transaction.account,
    parts: row.items.map(({ category, labels, event }, place) => ({ category, labels, event, euros: euros[place] ?? null })),
  }
}

/** Every row of the book as the figures count it, each at the rate of its day. */
export function countedRows(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'items'>, rates: RateBook): CountedRow[] {
  return euroRows(book, rates).map(countedRowOf)
}
