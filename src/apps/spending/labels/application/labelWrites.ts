import { heldItemsOf, waitingItemsOf, writeRows } from '../../entries/application/rowRecords'
import { withLabel, withoutLabel } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { SHARED_COST_WRITES } from '../../sharedCosts/application/sharedCostRecords'
import { SHORTCUT_PART_WRITES } from '../../shortcuts/application/shortcutWrites'
import { RULE_WRITES } from '../../statements/application/ruleRecords'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from '../../workbook/domain/words'
import type { Transaction } from '../../workbook/domain/transaction'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A label keeps a name no other label has once folded, and stays while an item names it, but Undo takes back one a write added. */
export const LABEL_WRITES: WriteRules<Label> = {
  kind: LABEL_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LABEL_RECORDS, read, records).readings.labels,
  refusals: (_change, fresh, after) => dependentRefusals(['labels', 'items', 'shortcutParts', 'rules', 'sharedCosts'], fresh, after),
}

/** The rows and items a label write reads of the file. */
type LabelRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts' | 'shortcutParts' | 'rules' | 'sharedCosts'>

/** Adds the label, which `newLabel` made, so the same write can put it on rows. */
export function addLabel(unit: UnitOfWork, label: Label): void {
  unit.of(LABEL_WRITES).add(label)
}

/** The label under the name, trimmed. Items name it by its id, so every item keeps it. */
export function renameLabel(unit: UnitOfWork, label: Label, name: string): void {
  unit.of(LABEL_WRITES).change(label, { ...label, name: name.trim() })
}

/**
 * Deletes the label and takes it off every item, waiting receipt's line, part of a quick add, rule and shared cost in the same write, so one Undo
 * puts it all back. A rule that only added the label goes with it.
 */
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
  recordsOf(records.shortcutParts)
    .filter((part) => part.labels.includes(label.id))
    .forEach((part) => unit.of(SHORTCUT_PART_WRITES).change(part, { ...part, labels: part.labels.filter((held) => held !== label.id) }))
  recordsOf(records.sharedCosts)
    .filter((sharedCost) => sharedCost.labels.includes(label.id))
    .forEach((sharedCost) => unit.of(SHARED_COST_WRITES).change(sharedCost, { ...sharedCost, labels: sharedCost.labels.filter((held) => held !== label.id) }))
  recordsOf(records.rules)
    .filter((rule) => rule.labels.includes(label.id))
    .forEach((rule) => {
      const labels = rule.labels.filter((held) => held !== label.id)
      if (labels.length === 0 && rule.category === null) unit.of(RULE_WRITES).remove(rule)
      else unit.of(RULE_WRITES).change(rule, { ...rule, labels })
    })
  unit.of(LABEL_WRITES).remove(label)
}

/**
 * Puts the label on every item of each row, or takes it off with `on` false, in one write. With `parts`, a row with a part
 * among them changes those parts alone, such as one line of a receipt. A file from before items keeps no labels, so it moves to
 * items first.
 */
export function labelRows(unit: UnitOfWork, records: LabelRecords, rows: readonly Transaction[], label: RecordId, on: boolean, parts: ReadonlySet<RecordId> = new Set()): void {
  if (isBeforeItems(records)) throw new Error(words.beforeItems('labels'))
  const itemsOf = heldItemsOf(records)
  const labelled = on ? withLabel : withoutLabel
  writeRows(
    unit,
    records,
    rows.map((row) => {
      const items = itemsOf(row)
      const named = items.filter((item) => parts.has(item.id))
      const changed = new Map(labelled(named.length > 0 ? named : items, label).map((item) => [item.id, item]))
      return { before: row, after: row, items: items.map((item) => changed.get(item.id) ?? item) }
    }),
  )
}
