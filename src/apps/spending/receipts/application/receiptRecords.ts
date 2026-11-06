import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { ReceiptLine } from '../../workbook/domain/receiptLine'
import { LINE_RECORDS, RECEIPT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A receipt names its entry, and its lines name it. */
export const RECEIPT_WRITES: WriteRules<Receipt> = {
  kind: RECEIPT_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RECEIPT_RECORDS, read, records).readings.receipts,
  refusals: (_change, fresh, after) => dependentRefusals(['receipts', 'lines'], fresh, after),
}

/** The lines of an entry add up to its amount, so a write changes them together or not at all. */
export const LINE_WRITES: WriteRules<ReceiptLine> = {
  kind: LINE_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LINE_RECORDS, read, records).readings.lines,
  refusals: (_change, fresh, after) => dependentRefusals(['lines'], fresh, after),
}

/** Takes the row's receipt and lines out, which leaves the row under its category. A photo kept on Drive stays there. */
export function removeReceiptOf(unit: UnitOfWork, records: Pick<SpendingRecords, 'receipts' | 'lines'>, row: Pick<Transaction, 'id'>): void {
  recordsOf(records.lines)
    .filter((line) => line.transaction === row.id)
    .forEach((line) => unit.of(LINE_WRITES).remove(line))
  recordsOf(records.receipts)
    .filter((receipt) => receipt.transaction === row.id)
    .forEach((receipt) => unit.of(RECEIPT_WRITES).remove(receipt))
}
