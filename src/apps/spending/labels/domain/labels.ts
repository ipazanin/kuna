import type { Label } from '../../workbook/domain/label'
import { LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

/** A new label of the name, trimmed, with an id of its own, so a write can add it and put it on items at once. */
export function newLabel(name: string): Label {
  return { id: recordIdOf(LABEL_RECORDS, newRecordId()), name: name.trim() }
}

/** The label that has the name once folded, or null, so a name typed again picks the label it already is. */
export function labelCalled(name: string, labels: readonly Label[]): Label | null {
  const folded = fold(name)
  return folded === '' ? null : (labels.find((label) => fold(label.name) === folded) ?? null)
}

/** Why a name cannot be a label's: it is blank, or another label of the file has it once folded, so `Prague` and `prague` are one label. */
export type LabelNameProblem = 'blank' | 'taken'

/** Why the name cannot be the label's, among the file's labels, or null when it can. `own` is the label being renamed, or null for a new one. */
export function labelNameProblem(name: string, labels: readonly Label[], own: RecordId | null): LabelNameProblem | null {
  const folded = fold(name)
  if (folded === '') return 'blank'
  return labels.some((label) => label.id !== own && fold(label.name) === folded) ? 'taken' : null
}

/** The items with the label on each, where it is not already. */
export function withLabel(items: readonly TransactionItem[], label: RecordId): readonly TransactionItem[] {
  return items.map((item) => (item.labels.includes(label) ? item : { ...item, labels: [...item.labels, label] }))
}

/** The items with the label off each. */
export function withoutLabel(items: readonly TransactionItem[], label: RecordId): readonly TransactionItem[] {
  return items.map((item) => (item.labels.includes(label) ? { ...item, labels: item.labels.filter((held) => held !== label) } : item))
}
