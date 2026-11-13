import { BUDGET_WRITES } from '../../budgets/application/budgetWrites'
import { ITEM_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import { RULE_WRITES } from '../../statements/application/statementWrites'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import { isFixedKind } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
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
    ...dependentRefusals(['categories', 'transactions', 'budgets', 'rules', 'items'], fresh, after),
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
  recordsOf(records.transactions)
    .filter((entry) => entry.category === category.id)
    .forEach((entry) => unit.of(TRANSACTION_WRITES).change(entry, { ...entry, category: target.id }))
  recordsOf(records.items)
    .filter((part) => part.category === category.id)
    .forEach((part) => unit.of(ITEM_WRITES).change(part, { ...part, category: target.id }))
  recordsOf(records.rules)
    .filter((rule) => rule.category === category.id)
    .forEach((rule) => unit.of(RULE_WRITES).change(rule, { ...rule, category: target.id }))
  recordsOf(records.budgets)
    .filter((budget) => budget.category === category.id)
    .forEach((budget) => unit.of(BUDGET_WRITES).remove(budget))
  unit.of(CATEGORY_WRITES).remove(category)
}
