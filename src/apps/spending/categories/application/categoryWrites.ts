import { BUDGET_WRITES } from '../../budgets/application/budgetWrites'
import { heldItemsOf, waitingItemsOf, writeRows } from '../../entries/application/rowRecords'
import { RULE_WRITES } from '../../statements/application/statementWrites'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isFixedKind } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import { words } from './words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A category keeps its children, entries, parts of entries, limits and rules, and the three fixed ones are never deleted. */
export const CATEGORY_WRITES: WriteRules<Category> = {
  kind: CATEGORY_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(CATEGORY_RECORDS, read, records).readings.categories,
  refusals: (change, fresh, after) => [
    ...change.edits.flatMap((edit) => (edit.after === null && edit.before !== null && 'record' in edit.before && isFixedKind(edit.before.record.kind) ? [words.fixedKept(edit.before.label)] : [])),
    ...dependentRefusals(['categories', 'transactions', 'budgets', 'rules', 'lines', 'items'], fresh, after),
  ],
}

/** A new category, its name trimmed, with an id of its own. */
export function newCategory(category: Omit<Category, 'id'>): Category {
  return { ...category, name: category.name.trim(), id: recordIdOf(CATEGORY_RECORDS, newRecordId()) }
}

/**
 * Deletes the category, moves its entries, parts of entries and rules to another and deletes its limits, all in one write, so one Undo puts it all
 * back. The other category keeps its own limits, whose carry would change if they took on the deleted one's history.
 */
export function deleteInto(unit: UnitOfWork, records: SpendingRecords, category: Category, target: Category): void {
  const itemsOf = heldItemsOf(records)
  const waitingOf = waitingItemsOf(records)
  const moved = (item: TransactionItem): TransactionItem => (item.category === category.id ? { ...item, category: target.id } : item)
  writeRows(
    unit,
    records,
    recordsOf(records.transactions)
      .filter((entry) => itemsOf(entry).some((item) => item.category === category.id))
      .map((entry) => ({ before: entry, after: entry, items: itemsOf(entry).map(moved) })),
    recordsOf(records.receipts)
      .filter((receipt) => receipt.transaction === null && waitingOf(receipt.id).some((line) => line.category === category.id))
      .map((receipt) => ({ receipt: receipt.id, lines: waitingOf(receipt.id).map(moved) })),
  )
  recordsOf(records.rules)
    .filter((rule) => rule.category === category.id)
    .forEach((rule) => unit.of(RULE_WRITES).change(rule, { ...rule, category: target.id }))
  recordsOf(records.budgets)
    .filter((budget) => budget.category === category.id)
    .forEach((budget) => unit.of(BUDGET_WRITES).remove(budget))
  unit.of(CATEGORY_WRITES).remove(category)
}
