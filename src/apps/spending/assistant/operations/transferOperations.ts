import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { openedBy } from './accountOperations'
import { writeTransfer } from '../../entries/application/entryWrites'
import { fixedByBank } from '../../entries/domain/bankRows'
import { newTransfer } from '../../entries/domain/transfer'
import type { TransferRefusal, TypedTransfer } from '../../entries/domain/transfer'
import { words as entryWords } from '../../entries/presentation/words'
import type { Account } from '../../workbook/domain/account'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { itemizedRow, largestItem } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { ACCOUNT_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { absAccountMoney, accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What the entry dialog's transfer does: move money between two of the person's accounts, or change a transfer through either leg. */
export const TRANSFER_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-transfer',
    about:
      'Money moved between two of your accounts, as two legs under Between my accounts that name each other and have no payee, since the money stays yours. amount is what left from, above zero. toAmount is what reached to in its own currency, needed when the currencies differ. In one currency a lower toAmount writes the rest as a bank fee row.',
    input: inputOf({ from: TEXT, to: TEXT, date: TEXT, amount: NUMBER, toAmount: NUMBER_OR_NULL, note: TEXT }),
    refs: { from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { from: 'account', to: 'account-other', date: '2026-11-02', amount: 50, toAmount: null, note: '' },
  },
  {
    name: 'change-transfer',
    about:
      'Makes an entry a transfer between two of your accounts, or changes a transfer through either leg. The entry stays the leg its money already is, so an entry that is no transfer yet needs the account on its other side, and its payee goes, as a transfer has none. Amounts are above zero as in add-transfer. Null leaves a field as it is.',
    input: inputOf({ entry: TEXT, from: TEXT_OR_NULL, to: TEXT_OR_NULL, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, toAmount: NUMBER_OR_NULL, note: TEXT_OR_NULL }),
    refs: { entry: TRANSACTION_RECORDS.name, from: ACCOUNT_RECORDS.name, to: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', from: null, to: 'account-other', date: null, amount: null, toAmount: null, note: null },
  },
]

const TRANSFER_OPERATION_NAMES: ReadonlySet<string> = new Set(TRANSFER_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the transfer operations. */
export function isTransferStep(operation: string): boolean {
  return TRANSFER_OPERATION_NAMES.has(operation)
}

/** A transfer's legs from either one with their items, the money-out leg first, or null for a plain entry. */
export function legsOf(book: SpendingBook, row: Transaction): readonly [ItemizedRow, ItemizedRow] | null {
  const other = row.pair === null ? undefined : book.transactions.find((candidate) => candidate.id === row.pair)
  if (other === undefined) return null
  const [out, into] = row.amount < 0 ? [row, other] : [other, row]
  return [itemizedRow(book, out), itemizedRow(book, into)]
}

/** An amount above zero, as a transfer's legs are typed. */
function positiveOf(amount: number): AccountMoney {
  const money = accountMoneyFromAmount(amount)
  if (money <= 0) throw new StepRefused('A transfer amount is above zero.')
  return money
}

const REFUSALS: Readonly<Record<TransferRefusal, string>> = {
  'arrived-missing': "The two accounts' currencies differ, so toAmount says what reached the other one.",
  'arrived-above-sent': 'In one currency toAmount is not more than amount.',
  'no-fee-side': 'The bank fills both accounts, so the legs stay as the bank booked them and no fee row can go on either.',
  'saved-transfer': "A saved transfer's legs stay equal in one currency. A fee is an entry of its own.",
}

/** The legs of a transfer the step asks for, with the fee row less arriving in one currency writes, refused in a sentence when it cannot be kept. */
function typedTransfer(
  book: SpendingBook,
  sides: { readonly from: Account; readonly to: Account; readonly rowOnFrom: Transaction | null; readonly rowOnTo: Transaction | null },
  day: CivilDate,
  sent: AccountMoney,
  arrived: AccountMoney | null,
  note: string,
): TypedTransfer {
  const { from, to } = sides
  const transfer = transferCategoryOf(book.categories)
  if (transfer === null) throw new StepRefused('The file has no Between my accounts category to file a transfer under.')
  if (from.id === to.id) throw new StepRefused('A transfer moves money between two different accounts.')
  const date = openedBy(day, [from, to])
  const draft = { from: { account: from, row: sides.rowOnFrom, day: date }, to: { account: to, row: sides.rowOnTo, day: date }, sent, arrived }
  const typed = newTransfer(draft, { date, note, category: transfer.id }, book.categories, entryWords.dialog.fee)
  if ('refused' in typed) throw new StepRefused(REFUSALS[typed.refused])
  return typed
}

/** Writes a transfer step through the write the entry dialog uses, so both legs change in step. */
export function writeTransferStep(unit: UnitOfWork, book: SpendingBook, records: SpendingRecords, operation: string, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): void {
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  if (operation === 'add-transfer') {
    const from = accountOf(field['from'])
    const to = accountOf(field['to'])
    const arrived = field['toAmount'] === null ? null : positiveOf(field['toAmount'])
    const typed = typedTransfer(book, { from, to, rowOnFrom: null, rowOnTo: null }, dayOf(field['date']), positiveOf(field['amount']), arrived, field['note'] as string)
    writeTransfer(unit, records, null, null, typed)
    return
  }
  const before = found(book.transactions, idOf(field['entry']), 'row')
  const legs = legsOf(book, before)
  const legRows = legs?.map(({ row }) => row) ?? null
  const isOut = legs !== null || before.amount < 0
  const keptFrom = legRows?.[0]?.account ?? (isOut ? before.account : null)
  const keptTo = legRows?.[1]?.account ?? (isOut ? null : before.account)
  const fromId = field['from'] === null ? keptFrom : accountOf(field['from']).id
  const toId = field['to'] === null ? keptTo : accountOf(field['to']).id
  if (fromId === null || toId === null) throw new StepRefused('An entry that is no transfer yet needs the account on its other side.')
  const from = accountOf(fromId)
  const to = accountOf(toId)
  const sameCurrency = from.currency === to.currency
  const keptAmount = legs !== null ? absAccountMoney(legs[0].row.amount) : isOut || sameCurrency ? absAccountMoney(before.amount) : null
  const keptArrived = legs !== null ? absAccountMoney(legs[1].row.amount) : !isOut || sameCurrency ? absAccountMoney(before.amount) : null
  const amount = field['amount'] === null ? keptAmount : positiveOf(field['amount'])
  if (amount === null) throw new StepRefused('amount says what left the other account in its own currency.')
  const arrived = field['toAmount'] !== null ? positiveOf(field['toAmount']) : sameCurrency ? null : keptArrived
  const day = field['date'] === null ? (legs?.[0].row.date ?? before.date) : dayOf(field['date'])
  const moved = (row: Transaction): boolean => row.date !== day || absAccountMoney(row.amount) !== (row.amount < 0 ? amount : (arrived ?? amount))
  const booked = (legRows ?? [before]).find((row) => fixedByBank(row, accountOf(row.account)) && moved(row))
  if (booked !== undefined) throw new StepRefused(`The bank booked that leg on ${accountOf(booked.account).name}, so its date and amount stay.`)
  const itemized = itemizedRow(book, before)
  const note = (field['note'] as string | null) ?? largestItem(itemized.items)?.note ?? ''
  const rowOnFrom = legRows?.[0] ?? (isOut ? before : null)
  const rowOnTo = legRows?.[1] ?? (isOut ? null : before)
  writeTransfer(unit, records, itemized, legs, typedTransfer(book, { from, to, rowOnFrom, rowOnTo }, day, amount, arrived, note))
}
