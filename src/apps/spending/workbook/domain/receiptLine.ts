import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A part of an entry a receipt split. The lines of an entry add up to its amount, and the figures count them instead of the entry's category. */
export interface ReceiptLine {
  readonly id: RecordId
  readonly transaction: RecordId
  readonly receipt: RecordId
  /** As the till printed it, or blank. */
  readonly printed: string
  /** In plain words, or blank for a line that stands for the whole receipt. */
  readonly text: string
  /** Signed as the entry is, in its account's currency. */
  readonly amount: AccountMoney
  readonly category: RecordId
}
