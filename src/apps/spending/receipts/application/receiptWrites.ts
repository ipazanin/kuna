import { RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import { PART_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** The receipt, its lines in place of any parts of a split by hand, and the row they split, in one write, so one Undo takes it all back. */
export function writeReceiptSplit(unit: UnitOfWork, { before, row, receipt, lines, replaced }: ReceiptSplit): void {
  const entries = unit.of(TRANSACTION_WRITES)
  if (before === null) entries.add(row)
  else entries.change(before, row)
  unit.of(RECEIPT_WRITES).add(receipt)
  replaced.forEach((part) => unit.of(PART_WRITES).remove(part))
  lines.forEach((line) => unit.of(PART_WRITES).add(line))
}
