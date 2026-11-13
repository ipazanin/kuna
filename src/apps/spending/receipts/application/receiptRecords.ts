import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { Receipt } from '../../workbook/domain/receipt'
import { RECEIPT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A receipt names its entry, and its lines name it. */
export const RECEIPT_WRITES: WriteRules<Receipt> = {
  kind: RECEIPT_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RECEIPT_RECORDS, read, records).readings.receipts,
  refusals: (_change, fresh, after) => dependentRefusals(['receipts', 'items'], fresh, after),
}
