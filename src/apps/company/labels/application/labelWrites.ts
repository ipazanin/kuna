import { labelNameProblem, withLabel, withoutLabel } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { refuseOn } from '../../../../shared/storage/application/workbookWriteRefused'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { ITEM_WRITES } from '../../transactions/application/itemWrites'
import { installedPack } from '../../packs/packContribution'
import { ITEM_RECORDS, LABEL_RECORDS, RULE_RECORDS } from '../../workbook/domain/coreKinds'
import { RULE_WRITES } from '../../rules/application/ruleWrites'
import { ruleLabelIdsOf } from '../../rules/domain/readRules'
import { idsText } from '../../../../shared/storage/domain/storedFields'
import { readLabels } from '../../workbook/domain/labelReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import { storedItemsOfRow, storesItems } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/workbook'
import { words } from '../../workbook/domain/words'

/** A label keeps a name no other label has once folded, and stays while an item, a rule or a record of the pack carries it. Undo takes back one a write added. */
export const LABEL_WRITES: WriteRules<Label> = {
  kind: LABEL_RECORDS,
  get reads() {
    return [ITEM_RECORDS, RULE_RECORDS, ...installedPack().labelCarriers.map((carrier) => carrier.writes.kind)]
  },
  undoable: true,
  read: (read) => readLabels(read),
  refusals: (change, _fresh, after) => {
    const labels = recordsOf(change.after)
    const named = change.edits.flatMap((edit) => (edit.after !== null && 'record' in edit.after ? [edit.after.record] : []))
    const nameRefusals = named.flatMap((label) => {
      const problem = labelNameProblem(label.name, labels, label.id)
      return problem === 'blank' ? [words.labelRecords.blankName] : problem === 'taken' ? [words.labelRecords.nameTaken(label.name.trim())] : []
    })
    const carriers = installedPack().labelCarriers
    const carried = new Set([
      ...recordsOf(after.of(ITEM_RECORDS)).flatMap((item) => item.labels),
      ...recordsOf(after.of(RULE_RECORDS)).flatMap((rule) => ruleLabelIdsOf(rule.fields)),
      ...carriers.flatMap((carrier) => recordsOf(after.of(carrier.writes.kind)).flatMap((record) => carrier.labelsOf(record))),
    ])
    const removed = change.edits.flatMap((edit) => (edit.after === null && edit.before !== null && 'record' in edit.before ? [edit.before.record] : []))
    return [...nameRefusals, ...removed.filter((label) => carried.has(label.id)).map((label) => words.labelRecords.stillCarried(label.name))]
  },
}

/** Adds the label, which `newLabel` made, so the same write can put it on rows. */
export function addLabel(unit: UnitOfWork, label: Label): void {
  unit.of(LABEL_WRITES).add(label)
}

/** The label under the name, trimmed. Items name it by its id, so every item keeps it. */
export function renameLabel(unit: UnitOfWork, label: Label, name: string): void {
  unit.of(LABEL_WRITES).change(label, { ...label, name: name.trim() })
}

/** Deletes the label and takes it off every item, every rule and every record of the pack that carries it in the same write, so one Undo puts it all back. */
export function deleteLabel(unit: UnitOfWork, records: WorkbookRecords, label: Label): void {
  for (const item of recordsOf(records.items)) {
    if (item.labels.includes(label.id)) unit.of(ITEM_WRITES).change(item, withoutLabel([item], label.id)[0]!)
  }
  for (const rule of recordsOf(records.rules)) {
    const held = ruleLabelIdsOf(rule.fields)
    if (held.includes(label.id))
      unit.of(RULE_WRITES).change(rule, {
        fields: {
          ...rule.fields,
          label_ids: idsText(
            held.filter((id) => id !== label.id),
            LABEL_RECORDS,
          ),
        },
      })
  }
  for (const carrier of installedPack().labelCarriers) {
    for (const record of recordsOf(recordsOfKindIn(records, carrier.writes.kind))) {
      const held = carrier.labelsOf(record)
      if (held.includes(label.id))
        unit.of(carrier.writes).change(
          record,
          carrier.withLabels(
            record,
            held.filter((id) => id !== label.id),
          ),
        )
    }
  }
  unit.of(LABEL_WRITES).remove(label)
}

/**
 * Puts the label on each record of the pack the ids name, such as a cost the owner paid privately, or takes it off with `on`
 * false. Books from before items keep no labels.
 */
export function labelPackRecords(unit: UnitOfWork, records: WorkbookRecords, ids: ReadonlySet<RecordId>, label: RecordId, on: boolean): void {
  if (ids.size === 0) return
  refuseOn(storesItems(records) ? [] : [words.items.noLabelsBeforeItems])
  for (const carrier of installedPack().labelCarriers) {
    for (const record of recordsOf(recordsOfKindIn(records, carrier.writes.kind))) {
      if (!ids.has(carrier.idOf(record))) continue
      const held = carrier.labelsOf(record)
      const labels = on ? (held.includes(label) ? held : [...held, label]) : held.filter((id) => id !== label)
      if (labels.length !== held.length) unit.of(carrier.writes).change(record, carrier.withLabels(record, labels))
    }
  }
}

/**
 * Puts the label on every item of each bank row, or takes it off with `on` false, in one write. With `parts`, a row with a part
 * among them changes those parts alone. Books from before items keep no labels, so they move to items first.
 */
export function labelRows(
  unit: UnitOfWork,
  records: Pick<WorkbookRecords, 'ledger' | 'items'>,
  rows: readonly Pick<Transaction, 'rowId'>[],
  label: RecordId,
  on: boolean,
  parts: ReadonlySet<RecordId> = new Set(),
): void {
  refuseOn(storesItems(records) ? [] : [words.items.noLabelsBeforeItems])
  const labelled = on ? withLabel : withoutLabel
  for (const row of rows) {
    const items = storedItemsOfRow(records.items, row)
    const named = items.filter((item) => parts.has(item.id))
    const chosen = named.length > 0 ? named : items
    labelled(chosen, label).forEach((item, at) => {
      if (item !== chosen[at]) relabelItem(unit, records, chosen[at]!, item.labels)
    })
  }
}

/** The part with these labels in place of those it carries, as a row's dialog sets them. Books from before items keep no labels. */
export function relabelItem(unit: UnitOfWork, records: Pick<WorkbookRecords, 'ledger' | 'items'>, item: ItemRecord, labels: readonly RecordId[]): void {
  refuseOn(storesItems(records) ? [] : [words.items.noLabelsBeforeItems])
  unit.of(ITEM_WRITES).change(item, { ...item, labels })
}
