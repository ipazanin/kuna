import { RECEIPT_WRITES } from './receiptRecords'
import type { ReceiptSplit } from '../domain/receiptSplit'
import type { PlacedReceipt } from '../domain/waitingReceipts'
import { writeRows } from '../../entries/application/rowRecords'
import { addPartPayees } from '../../payees/application/payeeWrites'
import type { PartPayeeRecords } from '../../payees/application/payeeWrites'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { Receipt } from '../../workbook/domain/receipt'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The rows and items a receipt write reads of the file. */
type ReceiptRecords = Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>

/**
 * The receipt, its lines in place of the row's items, and the row they split, in one write, so one Undo takes it all back. A
 * receipt that waits for the bank's row writes no row. Each line keeps the labels, event choice and payee `receiptSplit` gave
 * it, and a name a line counts under that no payee holds yet joins the payees as a person in the same write.
 */
export function writeReceiptSplit(unit: UnitOfWork, records: ReceiptRecords & PartPayeeRecords, { before, row, receipt, lines }: ReceiptSplit): void {
  unit.of(RECEIPT_WRITES).add(receipt)
  addPartPayees(unit, records, lines)
  if (row === null) writeRows(unit, records, [], [{ receipt: receipt.id, lines }])
  else writeRows(unit, records, [{ before, after: row, items: lines, chosen: idsOf(lines) }])
}

/** A waiting receipt on a row already on the file, with its lines as the row's items, in one write. Each line keeps the labels and event choice `receiptOnRow` gave it. */
export function placeWaitingReceipt(unit: UnitOfWork, records: ReceiptRecords, placed: PlacedReceipt): void {
  unit.of(RECEIPT_WRITES).change(placed.receipt.before, placed.receipt.after)
  writeRows(unit, records, [{ before: placed.before, after: placed.row, items: placed.items, chosen: idsOf(placed.items) }])
}

function idsOf(lines: readonly TransactionItem[]): ReadonlySet<RecordId> {
  return new Set(lines.map((line) => line.id))
}

/** A waiting receipt gone with its lines, which no figure counted. A photo kept on Drive stays there. */
export function removeWaitingReceipt(unit: UnitOfWork, records: ReceiptRecords, receipt: Receipt): void {
  writeRows(unit, records, [], [{ receipt: receipt.id, lines: [] }])
  unit.of(RECEIPT_WRITES).remove(receipt)
}
