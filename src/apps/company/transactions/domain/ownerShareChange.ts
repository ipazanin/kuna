import type { ShareTarget } from '../../owner-share/domain/ownerShare'
import { needsReview } from '../../workbook/domain/needsReview'
import { bookedRowOf } from './listedRows'
import type { ListedRow } from './listedRows'

/**
 * Where Transactions sets a listed row's owner share: on its ledger row, on a part of a split row, or
 * on an owner advance, each only while it counts as operating cost. Either part of a shared row, and
 * the heading above them, set the share of the row as booked. A row still waiting is settled on
 * Review, which copies the category's default.
 */
export function ownerShareChangeOf(row: ListedRow): ShareTarget | null {
  const booked = bookedRowOf(row)
  if (booked.bucket !== 'operating') {
    return null
  }
  if (booked.kind === 'owner-advance') {
    return { holder: 'owner-advance', id: booked.advance.id }
  }
  if (booked.split !== undefined) {
    return { holder: 'split-part', id: booked.split.id }
  }
  return needsReview(booked) ? null : { holder: 'ledger', id: booked.id }
}
