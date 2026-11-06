import { LINE_WRITES, RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import { CATEGORY_WRITES } from '../../categories/application/categoryWrites'
import { TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import type { Category } from '../../workbook/domain/category'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** The receipt, its lines, the row they split and any category you accepted for them, in one write, so one Undo takes it all back. */
export function writeReceiptSplit(unit: UnitOfWork, { before, row, receipt, lines }: ReceiptSplit, newCategories: readonly Category[] = []): void {
  newCategories.forEach((category) => unit.of(CATEGORY_WRITES).add(category))
  const entries = unit.of(TRANSACTION_WRITES)
  if (before === null) entries.add(row)
  else entries.change(before, row)
  unit.of(RECEIPT_WRITES).add(receipt)
  lines.forEach((line) => unit.of(LINE_WRITES).add(line))
}
