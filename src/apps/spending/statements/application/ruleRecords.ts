import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import type { DroppedRow } from '../../workbook/domain/droppedRow'
import { DROPPED_ROW_RECORDS, HELD_ROW_RECORDS, RULE_RECORDS } from '../../workbook/domain/spendingKinds'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A rule names a category that counts. */
export const RULE_WRITES: WriteRules<SpendingRule> = {
  kind: RULE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RULE_RECORDS, read, records).readings.rules,
  refusals: (_change, fresh, after) => dependentRefusals(['rules'], fresh, after),
}

/** A bank row on hold reads as `readHeld` says. */
export const HELD_ROW_WRITES: WriteRules<HeldBankRow> = {
  kind: HELD_ROW_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(HELD_ROW_RECORDS, read, records).readings.held,
  refusals: (_change, fresh, after) => dependentRefusals(['held'], fresh, after),
}

/** A payment the bank dropped names an account that counts. */
export const DROPPED_ROW_WRITES: WriteRules<DroppedRow> = {
  kind: DROPPED_ROW_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(DROPPED_ROW_RECORDS, read, records).readings.dropped,
  refusals: (_change, fresh, after) => dependentRefusals(['dropped'], fresh, after),
}
