import { TEXT, found, inputOf } from '../../../../shared/app/operationInput'
import { placeWaitingReceipt, removeWaitingReceipt } from '../../receipts/application/receiptWrites'
import { words as receiptWords } from '../../receipts/domain/words'
import { rowPlace } from '../../receipts/domain/receiptSplit'
import { receiptOnRow, waitingReceipts } from '../../receipts/domain/waitingReceipts'
import type { WaitingReceipt } from '../../receipts/domain/waitingReceipts'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { RECEIPT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What To review offers for a receipt that waits for the bank's row: putting it on a payment it may be, or removing it. */
export const WAITING_RECEIPT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'place-waiting-receipt',
    about:
      "Puts a receipt that waits for the bank's row on the payment it is, one To review offers for it on its account. Use it when the bank brought more than one that could be it or its text does not name the merchant. The entry files under the receipt's lines, and a Difference line makes up any cents the bank booked beyond the total.",
    input: inputOf({ waitingReceipt: TEXT, entry: TEXT }),
    refs: { waitingReceipt: RECEIPT_RECORDS.name, entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { waitingReceipt: 'receipt-waiting', entry: 'transaction-waiting-match' },
  },
  {
    name: 'remove-waiting-receipt',
    about: "Removes a receipt that waits for the bank's row, with its lines, which counted nowhere yet. The photo stays where it was kept.",
    input: inputOf({ waitingReceipt: TEXT }),
    refs: { waitingReceipt: RECEIPT_RECORDS.name },
    creates: null,
    alone: false,
    example: { waitingReceipt: 'receipt-waiting' },
  },
]

function waitingOf(book: SpendingBook, id: string): WaitingReceipt {
  const receipt = found(book.receipts, id, 'receipt')
  return waitingReceipts(book).find((waiting) => waiting.receipt === receipt) ?? refuseNotWaiting()
}

function refuseNotWaiting(): never {
  throw new StepRefused("That receipt is on an entry already, so remove-receipt takes it off. Only a receipt with no entry waits for the bank's row.")
}

/** Writes what To review offers for the waiting receipt, refused when it offers nothing of the kind. */
export function writeWaitingReceiptStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items'>,
  operation: string,
  field: Readonly<Record<string, string>>,
  idOf: (value: unknown) => string,
): void {
  const waiting = waitingOf(book, idOf(field['waitingReceipt']))
  if (operation === 'remove-waiting-receipt') {
    removeWaitingReceipt(unit, records, waiting.receipt)
    return
  }
  const entry = idOf(field['entry'])
  const candidate = waiting.matches.kind === 'none' ? undefined : waiting.matches.candidates.find(({ row }) => row.id === entry)
  if (candidate === undefined)
    throw new StepRefused("To review offers no such payment for that receipt. It offers the rows on the receipt's account the receipt may be, as match_records with kind receipt finds them.")
  placeWaitingReceipt(unit, records, receiptOnRow(waiting.receipt, waiting.lines, rowPlace(candidate.row, book.items), receiptWords.difference))
}
