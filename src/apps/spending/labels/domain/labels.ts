import type { Label } from '../../workbook/domain/label'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

/** Why a name cannot be a label's: it is blank, or another label of the file has it once folded, so `Prague` and `prague` are one label. */
export type LabelNameProblem = 'blank' | 'taken'

/** Why the name cannot be the label's, among the file's labels, or null when it can. `own` is the label being renamed, or null for a new one. */
export function labelNameProblem(name: string, labels: readonly Label[], own: RecordId | null): LabelNameProblem | null {
  const folded = fold(name)
  if (folded === '') return 'blank'
  return labels.some((label) => label.id !== own && fold(label.name) === folded) ? 'taken' : null
}

/** Every label the items carry, each once, in the order the items first carry them. */
export function labelsOf(items: readonly Pick<TransactionItem, 'labels'>[]): readonly RecordId[] {
  return [...new Set(items.flatMap((item) => item.labels))]
}

/**
 * The items a write leaves, with the labels of the items they replace. A part that kept its id and did not grow keeps its own
 * labels, and a new part or one that grew takes every label of the parts it took money from, so a re-split loses none.
 */
export function carriedLabels(found: readonly TransactionItem[], left: readonly TransactionItem[]): readonly TransactionItem[] {
  const replacements = partReplacements(found, left)
  if (replacements.length === 0) return left
  const labelsById = new Map(found.map((item) => [item.id, item.labels]))
  const replacing = new Map(replacements.map(({ part, replaces }) => [part, replaces]))
  return left.map((item) => {
    const replaces = replacing.get(item.id)
    if (replaces === undefined) return item
    const carried = labelsOf([item, ...replaces.map((id) => ({ labels: labelsById.get(id) ?? [] }))])
    return carried.length === item.labels.length ? item : { ...item, labels: carried }
  })
}

/** The items with the label on each, where it is not already. */
export function withLabel(items: readonly TransactionItem[], label: RecordId): readonly TransactionItem[] {
  return items.map((item) => (item.labels.includes(label) ? item : { ...item, labels: [...item.labels, label] }))
}

/** The items with the label off each. */
export function withoutLabel(items: readonly TransactionItem[], label: RecordId): readonly TransactionItem[] {
  return items.map((item) => (item.labels.includes(label) ? { ...item, labels: item.labels.filter((held) => held !== label) } : item))
}
