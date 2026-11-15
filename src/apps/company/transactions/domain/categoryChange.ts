import { needsReview } from '../../workbook/domain/needsReview'
import type { ListedRow } from './listedRows'
import type { SplitPart } from '../../workbook/domain/splits'

/**
 * Where Transactions changes a listed row's category: on its ledger row, or for a part of a split
 * row in the split editor, since the splits tab holds the parts' categories. Either part of a shared
 * row changes the ledger row it comes from. A row still waiting is settled on the To review tab, and an owner
 * advance is a row of its own tab, so neither changes here.
 */
export type CategoryChange = 'ledger' | 'split' | null

export function categoryChangeOf(row: ListedRow): CategoryChange {
  if (row.kind !== 'bank') {
    return null
  }
  if (row.split !== undefined) {
    return 'split'
  }
  return needsReview(row.ownerPart?.whole ?? row) ? null : 'ledger'
}

/** Whether a split row's parts are all in one category, as a payment placed on several invoices is, so changing its category refiles every part. */
export function filedInOneCategory(parts: readonly Pick<SplitPart, 'category'>[]): boolean {
  return parts.length > 0 && parts.every((part) => part.category === parts[0]!.category)
}
