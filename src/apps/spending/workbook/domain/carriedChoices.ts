import { BY_DAYS } from './event'
import type { EventChoice } from './event'
import { largestItem } from './rowItems'
import type { TransactionItem } from './transactionItem'
import { carriedLabels, labelsOf } from '../../../../shared/categorising/domain/labels'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Those labels of the items a rule put on, a label any item carries by hand counting as one put on by hand, so a rule never takes it off. */
export function ruleLabelsOf(items: readonly Pick<TransactionItem, 'labels' | 'ruleLabels'>[]): readonly RecordId[] {
  return labelsOf(items).filter((label) => items.every((item) => !item.labels.includes(label) || item.ruleLabels.includes(label)))
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
  const labelled = carriedLabels(found, left)
  const replacements = partReplacements(found, labelled)
  if (replacements.length === 0) return labelled
  const foundById = new Map(found.map((item) => [item.id, item]))
  const replacing = new Map(replacements.map(({ part, replaces }) => [part, replaces.flatMap((id) => foundById.get(id) ?? [])]))
  return labelled.map((item) => {
    const replaces = replacing.get(item.id)
    if (replaces === undefined || item.event !== BY_DAYS) return item
    const event = eventOfLargest(replaces)
    return event === item.event ? item : { ...item, event }
  })
}
