import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The shared costs a row can join, newest first by their day: every one not settled, however old, and the ones the row is in
 * already, so a member of a settled one still shows its home.
 */
export function openSharedCosts(sharedCosts: readonly SharedCost[], own: readonly (RecordId | null)[] = []): SharedCost[] {
  return sharedCosts.filter((sharedCost) => !sharedCost.settled || own.includes(sharedCost.id)).sort((first, second) => (first.day < second.day ? 1 : first.day > second.day ? -1 : 0))
}

/** The one shared cost not settled, which a row that came in may be a repayment for, or null while there are none or several. */
export function onlyOpenSharedCost(sharedCosts: readonly SharedCost[]): SharedCost | null {
  const open = sharedCosts.filter((sharedCost) => !sharedCost.settled)
  return open.length === 1 ? open[0]! : null
}
