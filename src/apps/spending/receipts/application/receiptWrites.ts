import { RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import type { PlacedReceipt } from '../domain/waitingReceipts'
import { ITEM_WRITES, TRANSACTION_WRITES } from '../../entries/application/entryWrites'
import { heldItemsOf } from '../../entries/domain/entrySplit'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { PartReplacement } from '../../../../shared/categorising/domain/partReplacements'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'

/**
 * The receipt, its lines in place of any parts of a split by hand, and the row they split, in one write, so one Undo takes it
 * all back. A receipt that waits for the bank's row writes no row. Gives what each line replaces of a row on the file: every
 * part it held, since no line can say which part it was.
 */
export function writeReceiptSplit(unit: UnitOfWork, { before, row, receipt, lines, replaced }: ReceiptSplit): readonly PartReplacement<RecordId>[] {
  const entries = unit.of(TRANSACTION_WRITES)
  if (row !== null && before === null) entries.add(row)
  if (row !== null && before !== null) entries.change(before, row)
  unit.of(RECEIPT_WRITES).add(receipt)
  replaced.forEach((part) => unit.of(ITEM_WRITES).remove(part))
  lines.forEach((line) => unit.of(ITEM_WRITES).add(line))
  return before === null ? [] : partReplacements(heldItemsOf(before, replaced), lines)
}

/**
 * A waiting receipt and its lines on the row they now name. The import that adds the row writes the row itself. Gives what each
 * line replaces of the row: every part it held, as for a receipt confirmed on the row.
 */
export function writeReceiptPlaced(unit: UnitOfWork, { before: row, receipt, lines, replaced, difference }: PlacedReceipt): readonly PartReplacement<RecordId>[] {
  unit.of(RECEIPT_WRITES).change(receipt.before, receipt.after)
  lines.forEach(({ before, after }) => unit.of(ITEM_WRITES).change(before, after))
  replaced.forEach((part) => unit.of(ITEM_WRITES).remove(part))
  if (difference !== null) unit.of(ITEM_WRITES).add(difference)
  const placed = lines.map(({ after }) => after)
  return partReplacements(heldItemsOf(row, replaced), difference === null ? placed : [...placed, difference])
}

/** A waiting receipt the person put on a row already on the file, with the row it files, in one write. */
export function placeWaitingReceipt(unit: UnitOfWork, placed: PlacedReceipt): readonly PartReplacement<RecordId>[] {
  unit.of(TRANSACTION_WRITES).change(placed.before, placed.row)
  return writeReceiptPlaced(unit, placed)
}

/** A waiting receipt gone with its lines, which no figure counted. A photo kept on Drive stays there. */
export function removeWaitingReceipt(unit: UnitOfWork, records: Pick<SpendingRecords, 'items'>, receipt: Receipt): void {
  recordsOf(records.items)
    .filter((line) => line.receipt === receipt.id)
    .forEach((line) => unit.of(ITEM_WRITES).remove(line))
  unit.of(RECEIPT_WRITES).remove(receipt)
}
