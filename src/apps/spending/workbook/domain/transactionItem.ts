import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An item of a transaction, which a receipt or a person split it into. The items of a transaction add up to its amount, and the figures count them instead of the transaction's category. */
export interface TransactionItem {
  readonly id: RecordId
  /** Null on a line of a receipt that waits for the bank's row. */
  readonly transaction: RecordId | null
  /** The receipt whose line it is, or null for a part split by hand. */
  readonly receipt: RecordId | null
  /** As the till printed it, or blank. */
  readonly printed: string
  /** In plain words, or blank for a part that stands for the whole receipt or was left without words. */
  readonly text: string
  /** Signed as the entry is, in its account's currency. */
  readonly amount: AccountMoney
  readonly category: RecordId
}
