import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { EventChoice } from './event'
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
  /** Who this money counts under, as a payee record or a row names them, or blank for the entry's payee. Never the entry's payee itself. */
  readonly payee: string
  /** The shared cost this money is part of, which counts it in place of the item, or null. Its category is then In a shared cost. */
  readonly sharedCost: RecordId | null
  /** The record in another app this money is, such as the loan instalment it pays, or null. A link changes no figure. */
  readonly link: RowLink | null
  /** The labels this money carries, in the order they were put on it. A label sits beside the category and changes no figure of it. */
  readonly labels: readonly RecordId[]
  /** Those of `labels` a rule put on, which a rule change may take off again. A label put on by hand is never among them. */
  readonly ruleLabels: readonly RecordId[]
  /** Whether the money joins an event by its row's day, was put in one by hand, or was taken out of every event. An event changes no figure of the category. */
  readonly event: EventChoice
  /** Whether linking the entry to a loan's instalment split this part off, as against a part you made or a receipt's line. */
  readonly splitByLink: boolean
}
