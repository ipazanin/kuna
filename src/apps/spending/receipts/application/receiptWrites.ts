import { RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import type { PlacedReceipt } from '../domain/waitingReceipts'
import { writeRows } from '../../entries/application/rowRecords'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** The rows and items a receipt write reads of the file. */
type ReceiptRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/**
 * The receipt, its lines in place of the row's items, and the row they split, in one write, so one Undo takes it all back. A
 * receipt that waits for the bank's row writes no row. Each line takes every label of the items of a row on the file, since no
 * line can say which item it was.
 */
export function writeReceiptSplit(unit: UnitOfWork, records: ReceiptRecords, { before, row, receipt, lines }: ReceiptSplit): void {
  unit.of(RECEIPT_WRITES).add(receipt)
  if (row === null) writeRows(unit, records, [], [{ receipt: receipt.id, lines }])
  else writeRows(unit, records, [{ before, after: row, items: lines }])
}

/** A waiting receipt on a row already on the file, with its lines as the row's items, in one write. Each line takes the labels of the row's items, as for a receipt confirmed on the row. */
export function placeWaitingReceipt(unit: UnitOfWork, records: ReceiptRecords, placed: PlacedReceipt): void {
  unit.of(RECEIPT_WRITES).change(placed.receipt.before, placed.receipt.after)
  writeRows(unit, records, [{ before: placed.before, after: placed.row, items: placed.items }])
}

/** A waiting receipt gone with its lines, which no figure counted. A photo kept on Drive stays there. */
export function removeWaitingReceipt(unit: UnitOfWork, records: ReceiptRecords, receipt: Receipt): void {
  writeRows(unit, records, [], [{ receipt: receipt.id, lines: [] }])
  unit.of(RECEIPT_WRITES).remove(receipt)
}
