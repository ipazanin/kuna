import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { SHARED_COST_RECORDS } from '../../workbook/domain/spendingKinds'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A shared cost names a spending or income category, labels and an event the file holds, and its members follow the rule of a member, but Undo takes back one a write added. */
export const SHARED_COST_WRITES: WriteRules<SharedCost> = {
  kind: SHARED_COST_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SHARED_COST_RECORDS, read, records).readings.sharedCosts,
  refusals: (_change, fresh, after) => dependentRefusals(['sharedCosts', 'items'], fresh, after),
}
