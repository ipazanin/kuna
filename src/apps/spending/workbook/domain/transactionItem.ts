import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RowLink } from './rowLink'

/** An item of a transaction: all of its money, or a part a receipt or a person split it into. The items of a transaction add up to its amount, and every figure counts them. */
export interface TransactionItem {
  readonly id: RecordId
  /** Null on a line of a receipt that waits for the bank's row. */
  readonly transaction: RecordId | null
  /** The receipt whose line it is, or null for a part split by hand. */
  readonly receipt: RecordId | null
  /** As the till printed it, or blank. */
  readonly printed: string
  /** Your words on this money, or a receipt line's plain words, or blank. */
  readonly note: string
  /** Signed as the entry is, in its account's currency. */
  readonly amount: AccountMoney
  /** Null only on the one item of a row waiting on review. */
  readonly category: RecordId | null
  /** The record in another app this money is, such as the loan instalment it pays, or null. A link changes no figure. */
  readonly link: RowLink | null
}
