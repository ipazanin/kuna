import { RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import type { PlacedReceipt } from '../domain/waitingReceipts'
import { PART_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

/**
 * The receipt, its lines in place of any parts of a split by hand, and the row they split, in one write, so one Undo takes it
 * all back. A receipt that waits for the bank's row writes no row.
 */
export function writeReceiptSplit(unit: UnitOfWork, { before, row, receipt, lines, replaced }: ReceiptSplit): void {
  const entries = unit.of(TRANSACTION_WRITES)
  if (row !== null && before === null) entries.add(row)
  if (row !== null && before !== null) entries.change(before, row)
  unit.of(RECEIPT_WRITES).add(receipt)
  replaced.forEach((part) => unit.of(PART_WRITES).remove(part))
  lines.forEach((line) => unit.of(PART_WRITES).add(line))
}

/** A waiting receipt and its lines on the row they now name. The import that adds the row writes the row itself. */
export function writeReceiptPlaced(unit: UnitOfWork, { receipt, lines, replaced, difference }: PlacedReceipt): void {
  unit.of(RECEIPT_WRITES).change(receipt.before, receipt.after)
  lines.forEach(({ before, after }) => unit.of(PART_WRITES).change(before, after))
  replaced.forEach((part) => unit.of(PART_WRITES).remove(part))
  if (difference !== null) unit.of(PART_WRITES).add(difference)
}

/** A waiting receipt the person put on a row already on the file, with the row it files, in one write. */
export function placeWaitingReceipt(unit: UnitOfWork, placed: PlacedReceipt): void {
  unit.of(TRANSACTION_WRITES).change(placed.before, placed.row)
  writeReceiptPlaced(unit, placed)
}

/** A waiting receipt gone with its lines, which no figure counted. A photo kept on Drive stays there. */
export function removeWaitingReceipt(unit: UnitOfWork, records: Pick<SpendingRecords, 'lines'>, receipt: Receipt): void {
  recordsOf(records.lines)
    .filter((line) => line.receipt === receipt.id)
    .forEach((line) => unit.of(PART_WRITES).remove(line))
  unit.of(RECEIPT_WRITES).remove(receipt)
}
