import { BY_DAYS } from './event'
import type { EventChoice } from './event'
import { largestItem } from './rowItems'
import type { TransactionItem } from './transactionItem'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Every label the items carry, each once, in the order the items first carry them. */
export function labelsOf(items: readonly Pick<TransactionItem, 'labels'>[]): readonly RecordId[] {
  return [...new Set(items.flatMap((item) => item.labels))]
}

/** The event choice of the item with the most money, so money that parts become again keeps what was chosen for most of it. */
export function eventOfLargest(items: readonly Pick<TransactionItem, 'amount' | 'event'>[]): EventChoice {
  return largestItem(items)?.event ?? BY_DAYS
}

/**
 * The items a write leaves, with what a person put on the items they replace. A part that kept its id and did not grow keeps its
 * own labels and event choice. A new part or one that grew takes every label of the parts it took money from, and, while it
 * goes by its day, the event choice of the largest of them, so a re-split loses neither.
 */
export function carriedChoices(found: readonly TransactionItem[], left: readonly TransactionItem[]): readonly TransactionItem[] {
  const replacements = partReplacements(found, left)
  if (replacements.length === 0) return left
  const foundById = new Map(found.map((item) => [item.id, item]))
  const replacing = new Map(replacements.map(({ part, replaces }) => [part, replaces.flatMap((id) => foundById.get(id) ?? [])]))
  return left.map((item) => {
    const replaces = replacing.get(item.id)
    if (replaces === undefined) return item
    const labels = labelsOf([item, ...replaces])
    const event = item.event === BY_DAYS ? eventOfLargest(replaces) : item.event
    return labels.length === item.labels.length && event === item.event ? item : { ...item, labels, event }
  })
}
