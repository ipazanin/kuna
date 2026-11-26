import { BY_DAYS } from './event'
import type { EventChoice } from './event'
import { largestItem } from './rowItems'
import type { TransactionItem } from './transactionItem'
import { samePayee } from '../../payees/domain/payeeKey'
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

/** The payee every item counts under, or blank for the entry's when they differ, so parts that become one keep a payee they all shared. */
export function payeeOfAll(items: readonly Pick<TransactionItem, 'payee'>[]): string {
  const [first, ...rest] = items
  return first !== undefined && rest.every((item) => samePayee(item.payee, first.payee)) ? first.payee : ''
}

/** The fields of a part's own money and place, which a write that rebuilds parts sets for each part it leaves. */
type PartOwnField = 'id' | 'transaction' | 'receipt' | 'printed' | 'note' | 'amount' | 'category' | 'link' | 'sharedCost' | 'splitByLink'

/** What a person put on money, which parts rebuilt from other parts keep. A field added to an item is carried until it is named a part's own. */
export type CarriedFields = Omit<TransactionItem, PartOwnField>

/** What parts rebuilt from the replaced ones carry: every label, a rule's still its, the event choice of the largest and the payee all of them counted under. */
export function carriedFields(replaced: readonly TransactionItem[]): CarriedFields {
  return { labels: labelsOf(replaced), ruleLabels: ruleLabelsOf(replaced), event: eventOfLargest(replaced), payee: payeeOfAll(replaced) }
}

/** The item, in the shared cost of the part of its id it replaces while it keeps that part's category, so a write that rebuilds a member keeps it a member. */
function withSharedCostKept(found: readonly TransactionItem[], item: TransactionItem): TransactionItem {
  if (item.sharedCost !== null) return item
  const kept = found.find((held) => held.id === item.id && held.category === item.category && held.sharedCost !== null)
  return kept === undefined ? item : { ...item, sharedCost: kept.sharedCost }
}

/**
 * The items a write leaves, with what a person put on the items they replace. A part that kept its id and did not grow keeps its
 * own labels and event choice. A new part or one that grew takes every label of the parts it took money from, and, while it
 * goes by its day, the event choice of the largest of them, so a re-split loses neither. A part that kept its id and its category
 * stays in its shared cost.
 */
export function carriedChoices(found: readonly TransactionItem[], left: readonly TransactionItem[]): readonly TransactionItem[] {
  const labelled = carriedLabels(found, left).map((item) => withSharedCostKept(found, item))
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
