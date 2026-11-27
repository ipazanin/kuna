import type { Transaction } from './transaction'
import type { TransactionItem } from './transactionItem'
import type { Category } from './category'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * A payment the bank had not booked that you had filed, which Kuna removed when the bank stopped listing it. It names the row
 * and how you filed it, and waits on To review until you press OK, since a sync that ran while you were away removed it.
 */
export interface DroppedRow {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  readonly amount: AccountMoney
  readonly payee: string
  /**
   * How you had filed it: the category most of its money was under, the labels of its parts and their notes, by the names they had
   * when the bank dropped it, so a category or label deleted or renamed later leaves the note as it was. Empty for a split with none of them.
   */
  readonly filing: string
}

/**
 * The note a gone row leaves when a person filed it: they picked its category, put a label or a note on it, split it or linked it.
 * Null for a row only the bank and the rules touched, since nothing of yours went with it.
 */
export function droppedRowOf(
  row: Transaction,
  items: readonly TransactionItem[],
  id: RecordId,
  named: { readonly categories: readonly Category[]; readonly labels: readonly Label[] },
): DroppedRow | null {
  const byHand = items.some((item) => item.note !== '' || item.link !== null || item.labels.some((label) => !item.ruleLabels.includes(label)))
  if (row.categorisedBy !== 'person' && !byHand && items.length < 2) return null
  const category = mainCategoryOf(items)
  return {
    id,
    account: row.account,
    date: row.date,
    amount: row.amount,
    payee: row.payee,
    filing: [
      named.categories.find((candidate) => candidate.id === category)?.name ?? '',
      ...new Set(items.flatMap((item) => item.labels).map((label) => named.labels.find((candidate) => candidate.id === label)?.name ?? '')),
      ...items.map((item) => item.note),
    ]
      .filter((part) => part !== '')
      .join(', '),
  }
}
