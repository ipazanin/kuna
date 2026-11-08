import { TEXT, inputOf } from '../../../../shared/app/operationInput'
import { joinWithTyped, notAPair, pairRows } from '../../statements/application/statementWrites'
import { reviewQueue } from '../../statements/domain/reviewQueue'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What To review offers for a waiting row: joining it with a typed row, pairing it as a transfer, or undoing a pair. */
export const REVIEW_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'join-rows',
    about: 'Joins a waiting bank row with the typed row To review offers as the same money. The typed row takes the bank’s day, amount and text, and the bank’s own row goes.',
    input: inputOf({ row: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction-joinable' },
  },
  {
    name: 'pair-rows',
    about: 'Pairs a waiting row with the row on another account To review offers as the other side of one transfer between your accounts.',
    input: inputOf({ row: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction-pairable' },
  },
  {
    name: 'unpair-rows',
    about: 'Undoes a transfer a statement paired: both legs go back to waiting, and a later import does not pair them again.',
    input: inputOf({ row: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction-paired' },
  },
]

/** The other leg of the transfer a statement paired, the money-out leg first, as To review lists it. */
function statementPair(book: SpendingBook, row: Transaction): { readonly debit: Transaction; readonly credit: Transaction } {
  const other = row.pair === null ? undefined : book.transactions.find((candidate) => candidate.id === row.pair)
  if (other === undefined) throw new StepRefused('That row is no transfer’s leg.')
  const [debit, credit] = row.amount < 0 ? [row, other] : [other, row]
  if (debit.source !== 'statement') throw new StepRefused('Only a transfer a statement paired can be undone this way. Change a typed transfer with change-entry.')
  return { debit, credit }
}

/** Writes what To review offers for the row, refused when it offers nothing of the kind. */
export function writeReviewStep(unit: UnitOfWork, book: SpendingBook, operation: string, row: Transaction): void {
  if (operation === 'unpair-rows') {
    notAPair(unit, statementPair(book, row))
    return
  }
  const waiting = reviewQueue(book, today()).waiting.find((candidate) => candidate.row.id === row.id)
  if (waiting === undefined) throw new StepRefused('That row does not wait on To review.')
  if (operation === 'join-rows') {
    if (waiting.maybeTyped === null) throw new StepRefused('To review offers no typed row as the same money for that row.')
    joinWithTyped(unit, waiting.maybeTyped.typed, waiting.maybeTyped.bank, book.lines)
    return
  }
  const transfer = book.categories.find((category) => category.kind === 'transfer')
  if (waiting.maybeTransfer === null || transfer === undefined) throw new StepRefused('To review offers no row on another account as the other side of that one.')
  pairRows(unit, waiting.maybeTransfer, transfer.id)
}
