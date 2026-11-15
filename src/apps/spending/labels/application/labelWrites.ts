import { heldItemsOf, waitingItemsOf, writeRows } from '../../entries/application/rowRecords'
import { withLabel, withoutLabel } from '../domain/labels'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import type { Label } from '../../workbook/domain/label'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A label keeps a name no other label has once folded, and stays while an item names it, but Undo takes back one a write added. */
export const LABEL_WRITES: WriteRules<Label> = {
  kind: LABEL_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LABEL_RECORDS, read, records).readings.labels,
  refusals: (_change, fresh, after) => dependentRefusals(['labels', 'items'], fresh, after),
}

/** The rows and items a label write reads of the file. */
type LabelRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>

/** Adds a label of the name, trimmed, with an id of its own, and gives it, so the same write can put it on rows. */
export function addLabel(unit: UnitOfWork, name: string): Label {
  const label: Label = { id: recordIdOf(LABEL_RECORDS, newRecordId()), name: name.trim() }
  unit.of(LABEL_WRITES).add(label)
  return label
}

/** The label under the name, trimmed. Items name it by its id, so every item keeps it. */
export function renameLabel(unit: UnitOfWork, label: Label, name: string): void {
  unit.of(LABEL_WRITES).change(label, { ...label, name: name.trim() })
}

/** Deletes the label and takes it off every item and waiting receipt's line in the same write, so one Undo puts it all back. */
export function deleteLabel(unit: UnitOfWork, records: LabelRecords, label: Label): void {
  const itemsOf = heldItemsOf(records)
  const waitingOf = waitingItemsOf(records)
  const carries = (items: readonly { readonly labels: readonly RecordId[] }[]): boolean => items.some((item) => item.labels.includes(label.id))
  writeRows(
    unit,
    records,
    recordsOf(records.transactions)
      .filter((entry) => carries(itemsOf(entry)))
      .map((entry) => ({ before: entry, after: entry, items: withoutLabel(itemsOf(entry), label.id) })),
    recordsOf(records.receipts)
      .filter((receipt) => receipt.transaction === null && carries(waitingOf(receipt.id)))
      .map((receipt) => ({ receipt: receipt.id, lines: withoutLabel(waitingOf(receipt.id), label.id) })),
  )
  unit.of(LABEL_WRITES).remove(label)
}

/** Puts the label on every item of each row, or takes it off with `on` false, in one write. A file from before items keeps no labels, so it moves to items first. */
export function labelRows(unit: UnitOfWork, records: LabelRecords, rows: readonly Transaction[], label: RecordId, on: boolean): void {
  if (isBeforeItems(records)) throw new Error('A file from before items keeps no labels. Move it to items first.')
  const itemsOf = heldItemsOf(records)
  const labelled = on ? withLabel : withoutLabel
  writeRows(
    unit,
    records,
    rows.map((row) => ({ before: row, after: row, items: labelled(itemsOf(row), label) })),
  )
}
