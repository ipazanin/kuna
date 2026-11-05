import { SPENDING_KINDS, bookWith } from '../../workbook/application/spendingWriteGuards'
import type { Budget } from '../../workbook/domain/budget'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { BUDGET_RECORDS } from '../../workbook/domain/spendingKinds'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A limit is read against its category and the limits of its group and children. */
export const BUDGET_WRITES: WriteRules<Budget> = {
  kind: BUDGET_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(BUDGET_RECORDS, read, records).readings.budgets,
  refusals: () => [],
}

/** Sets the category's limit from the month on, changing the budget that starts in that month or adding one. An amount of zero ends the limit. */
export function setLimit(unit: UnitOfWork, records: SpendingRecords, category: RecordId, from: MonthKey, amount: Money): void {
  const held = recordsOf(records.budgets).find((budget) => budget.category === category && budget.from === from)
  if (held === undefined) {
    unit.of(BUDGET_WRITES).add({ id: recordIdOf(BUDGET_RECORDS, newRecordId()), category, from, amount })
  } else {
    unit.of(BUDGET_WRITES).change(held, { ...held, amount })
  }
}
