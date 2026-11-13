import { TEXT, TEXT_OR_NULL, inputOf } from '../../../../shared/app/operationInput'
import { joinWithTyped, notAPair, notCash, pairRows, writeCashLegs } from '../../statements/application/statementWrites'
import { reviewQueue } from '../../statements/domain/reviewQueue'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Account } from '../../workbook/domain/account'
import { ACCOUNT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { today } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What To review offers for a waiting row: joining it with a typed row, pairing it as a transfer, undoing a pair, or moving a withdrawal to cash or saying it is none. */
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
  {
    name: 'move-to-cash',
    about:
      'Gives a cash withdrawal To review lists its other leg on a cash account of its currency, so the cash counts there and not as spending. cash_account null takes the one cash account To review proposes.',
    input: inputOf({ row: TEXT, cash_account: TEXT_OR_NULL }),
    refs: { row: TRANSACTION_RECORDS.name, cash_account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction-withdrawal', cash_account: null },
  },
  {
    name: 'not-cash',
    about: 'Says a row To review lists as a cash withdrawal is not one. It stays where it is filed, and To review no longer lists it.',
    input: inputOf({ row: TEXT }),
    refs: { row: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { row: 'transaction-withdrawal' },
  },
]

/** The cash account a withdrawal To review lists goes to: the one named among those it offers, or the one it proposes. */
function cashFor(book: SpendingBook, row: Transaction, named: Account | null): Account {
  const withdrawal = reviewQueue(book, today()).withdrawals.find((candidate) => candidate.row.id === row.id)
  if (withdrawal === undefined) throw new StepRefused('To review lists no cash withdrawal for that row.')
  const [only, ...others] = withdrawal.cashAccounts
  if (named !== null) return withdrawal.cashAccounts.find((account) => account.id === named.id) ?? refuseCash()
  if (only === undefined || others.length > 0) throw new StepRefused('Name the cash account, since the withdrawal’s currency has none or several.')
  return only
}

function refuseCash(): never {
  throw new StepRefused('That is not an open cash account of the withdrawal’s currency.')
}

/** The other leg of the transfer a statement paired, the money-out leg first, as To review lists it. */
function statementPair(book: SpendingBook, row: Transaction): { readonly debit: Transaction; readonly credit: Transaction } {
  const other = row.pair === null ? undefined : book.transactions.find((candidate) => candidate.id === row.pair)
  if (other === undefined) throw new StepRefused('That row is no transfer’s leg.')
  const [debit, credit] = row.amount < 0 ? [row, other] : [other, row]
  if (debit.source !== 'statement') throw new StepRefused('Only a transfer a statement paired can be undone this way. Change a typed transfer with change-entry.')
  return { debit, credit }
}

/** Writes what To review offers for the row, refused when it offers nothing of the kind. */
export function writeReviewStep(unit: UnitOfWork, book: SpendingBook, operation: string, row: Transaction, cashAccount: Account | null = null): void {
  const transfer = book.categories.find((category) => category.kind === 'transfer')
  if (operation === 'move-to-cash') {
    if (transfer === undefined) throw new StepRefused('The file has no Between my accounts category.')
    writeCashLegs(unit, book.stored, [{ row, cash: cashFor(book, row, cashAccount) }], transfer.id)
    return
  }
  if (operation === 'not-cash') {
    if (!reviewQueue(book, today()).withdrawals.some((candidate) => candidate.row.id === row.id)) throw new StepRefused('To review lists no cash withdrawal for that row.')
    notCash(unit, book.stored, row)
    return
  }
  if (operation === 'unpair-rows') {
    notAPair(unit, book.stored, statementPair(book, row))
    return
  }
  const waiting = reviewQueue(book, today()).waiting.find((candidate) => candidate.row.id === row.id)
  if (waiting === undefined) throw new StepRefused('That row does not wait on To review.')
  if (operation === 'join-rows') {
    if (waiting.maybeTyped === null) throw new StepRefused('To review offers no typed row as the same money for that row.')
    joinWithTyped(unit, book.stored, waiting.maybeTyped.typed, waiting.maybeTyped.bank)
    return
  }
  if (waiting.maybeTransfer === null || transfer === undefined) throw new StepRefused('To review offers no row on another account as the other side of that one.')
  pairRows(unit, book.stored, waiting.maybeTransfer, transfer.id)
}
