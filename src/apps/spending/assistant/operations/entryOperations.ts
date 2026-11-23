import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { openedBy } from './accountOperations'
import { givenPartPayee } from './splitOperations'
import { legsOf } from './transferOperations'
import { moveToItems } from '../../entries/application/rowRecords'
import { newEntry, removeEntry, writeEntry } from '../../entries/application/entryWrites'
import { fixedByBank } from '../../entries/domain/bankRows'
import { fileRows } from '../../statements/application/statementWrites'
import { setPayeeParty } from '../../payees/application/payeeWrites'
import { partPayeeOf } from '../../payees/domain/payeeKey'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { Account } from '../../workbook/domain/account'
import { isBeforeItems, moveBlockers } from '../../workbook/domain/beforeItems'
import type { Category } from '../../workbook/domain/category'
import { isTransferCategory } from '../../workbook/domain/category'
import { BY_DAYS } from '../../workbook/domain/event'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { isSplit, itemizedRow, wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import { absAccountMoney, accountMoneyFromAmount, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** Who all of an entry not split counts under, which a part of a split takes through split-entry. */
const COUNTS_UNDER: StrictSchema = {
  type: ['string', 'null'],
  description:
    'Who the entry\'s money counts under on the payee report when not its payee, "" for its payee, or null to leave it. A name no payee or entry has yet becomes a payee marked as a person. The payee stays who was paid.',
}

/** What the entry dialog does to a plain entry: add one, or file or fix one. */
export const ENTRY_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-entry',
    about:
      "A typed entry. Credits above zero, debits below, in the account's currency. category may be null to wait on To review. countsUnder is who the money counts under when not the payee, such as a friend a gift from a shop was for, or null.",
    input: inputOf({ account: TEXT, date: TEXT, amount: NUMBER, payee: TEXT, category: TEXT_OR_NULL, note: TEXT, countsUnder: COUNTS_UNDER }),
    refs: { account: ACCOUNT_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: TRANSACTION_RECORDS.name,
    alone: false,
    example: { account: 'account', date: '2026-11-01', amount: -12.5, payee: 'A shop', category: 'category', note: '', countsUnder: null },
  },
  {
    name: 'change-entry',
    about:
      "Files a row under a category, or fixes its account, kind, date, amount, payee or note. kind is out or in, and sets the amount's sign. A row a statement brought keeps its account and what the bank said, and on an account the bank fills its date and amount too. A transfer's leg given a kind or another category becomes a plain entry, and its other leg goes. Otherwise a leg takes a new account, date or amount only through change-transfer, and no payee. countsUnder is as in add-entry, for an entry not split. Null leaves a field as it is.",
    input: inputOf({
      entry: TEXT,
      account: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: 'out, in, or null to leave it.' },
      category: TEXT_OR_NULL,
      date: TEXT_OR_NULL,
      amount: NUMBER_OR_NULL,
      payee: TEXT_OR_NULL,
      note: TEXT_OR_NULL,
      countsUnder: COUNTS_UNDER,
    }),
    refs: { entry: TRANSACTION_RECORDS.name, account: ACCOUNT_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', account: null, kind: null, category: 'category', date: null, amount: null, payee: null, note: 'Checked', countsUnder: null },
  },
]

/** What the entry dialog's Delete does. */
export const DELETE_ENTRY: AssistantOperation = {
  name: 'delete-entry',
  about: 'Deletes an entry, with its other leg and its receipt.',
  input: inputOf({ entry: TEXT }),
  refs: { entry: TRANSACTION_RECORDS.name },
  creates: null,
  alone: false,
  example: { entry: 'transaction' },
}

/** What the entry dialog's person flag and the move notice do. */
export const PAYEE_AND_FILE_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'flag-person',
    about: "Flags an entry's payee as a person, so the chat sends the name under an alias from then on. Only a person takes a flag off, on the entry's dialog.",
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction' },
  },
  {
    name: 'move-to-items',
    about: 'Gives every entry of a file from before parts its own parts, which then hold its category, note and link. Undo takes it back until a reload.',
    input: inputOf({}),
    refs: {},
    creates: null,
    alone: true,
    example: {},
  },
]

const ENTRY_OPERATION_NAMES: ReadonlySet<string> = new Set([...ENTRY_OPERATIONS, DELETE_ENTRY, ...PAYEE_AND_FILE_OPERATIONS].map((operation) => operation.name))

/** Whether the step is one of the entry operations. */
export function isEntryStep(operation: string): boolean {
  return ENTRY_OPERATION_NAMES.has(operation)
}

/** Changes a plain entry or a transfer's leg as the entry dialog does, refused where a leg or a bank's row keeps a field. */
function changeEntry(unit: UnitOfWork, book: SpendingBook, records: SpendingRecords, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): void {
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  const before = itemizedRow(book, found(book.transactions, idOf(field['entry']), 'row'))
  const kind = choiceOf(['out', 'in'], field['kind'], 'kind')
  const filedUnder: Category | null = field['category'] === null ? null : found(book.categories, idOf(field['category']), 'category')
  const onlyFiled = [field['account'], field['kind'], field['date'], field['amount'], field['payee'], field['note'], field['countsUnder']].every((value) => value === null)
  const legs = legsOf(book, before.row)
  const plain = legs !== null && (kind !== null || (filedUnder !== null && !isTransferCategory(filedUnder)))
  const [whole] = before.items
  if (isSplit(before.items) && (filedUnder !== null || field['note'] !== null || field['countsUnder'] !== null))
    throw new StepRefused('That entry is split, so each part keeps its own category, note and payee it counts under. split-entry changes them.')
  if (onlyFiled && filedUnder !== null && legs === null) {
    fileRows(unit, records, [before.row], filedUnder)
    return
  }
  const amount = field['amount'] === null ? before.row.amount : accountMoneyFromAmount(field['amount'])
  const account = accountOf(field['account'] ?? before.row.account)
  const date = field['date'] === null ? before.row.date : dayOf(field['date'])
  const typed: Transaction = {
    ...before.row,
    account: account.id,
    date,
    amount: kind === null ? amount : kind === 'out' ? negateAccountMoney(absAccountMoney(amount)) : absAccountMoney(amount),
    payee: (field['payee'] as string | null) ?? before.row.payee,
    pair: plain ? null : before.row.pair,
  }
  const filing = {
    category: filedUnder?.id ?? whole?.category ?? null,
    note: (field['note'] as string | null) ?? whole?.note ?? '',
    link: whole?.link ?? null,
    labels: whole?.labels ?? [],
    event: whole?.event ?? BY_DAYS,
    countsUnder: countsUnderTyped(givenPartPayee(records, field['countsUnder']), typed.payee, whole?.payee ?? ''),
  }
  const onAccount = accountOf(before.row.account)
  if (fixedByBank(before.row, onAccount) && (typed.date !== before.row.date || typed.amount !== before.row.amount))
    throw new StepRefused(`The bank booked that row on ${onAccount.name}, so its date and amount stay. Its category, payee, note and split can change.`)
  if (legs !== null && !plain && (typed.account !== before.row.account || typed.date !== before.row.date || typed.amount !== before.row.amount))
    throw new StepRefused("That entry is a transfer's leg, so its account, date or amount change through change-transfer, which keeps both legs in step.")
  if (legs !== null && !plain && (typed.payee !== before.row.payee || partPayeeOf(filing.countsUnder, typed.payee) !== ''))
    throw new StepRefused("That entry is a transfer's leg, a move between the person's own accounts, so it takes no payee.")
  if (isSplit(before.items) && typed.amount !== before.row.amount) throw new StepRefused('That entry is split, so its amount stays. remove-split takes the split off first.')
  if (field['account'] !== null || field['date'] !== null) openedBy(date, [account])
  const otherLeg = plain ? (legs.map(({ row }) => row).find((leg) => leg.id !== before.row.id) ?? null) : null
  writeEntry(unit, records, before, { row: typed, items: [wholeItemOf(typed, filing)] }, otherLeg)
}

/**
 * The payee change-entry types for the money to count under. Left out, it types the one the entry counted under, so the entry
 * keeps it. A blank one types the entry's payee, which folds to blank and so clears another payee.
 */
function countsUnderTyped(given: string | null, entryPayee: string, held: string): string {
  if (given === null) return held
  return given.trim() === '' ? entryPayee : given
}

/** Writes an entry step through the writes the entry dialog uses, and gives the entry an add-entry step made so a later step names it by `$`. */
export function writeEntryStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): ItemizedRow | null {
  const rowOf = (value: unknown): Transaction => found(book.transactions, idOf(value), 'row')
  switch (operation) {
    case 'add-entry': {
      const account = found(book.accounts, idOf(field['account']), 'account')
      const entry = newEntry({
        account: account.id,
        date: openedBy(dayOf(field['date']), [account]),
        amount: accountMoneyFromAmount(field['amount']),
        payee: field['payee'],
        category: field['category'] === null ? null : found(book.categories, idOf(field['category']), 'category').id,
        note: field['note'],
        labels: [],
        ...(givenPartPayee(records, field['countsUnder']) === null ? {} : { countsUnder: field['countsUnder'] }),
      })
      writeEntry(unit, records, null, entry, null)
      return entry
    }
    case 'change-entry':
      changeEntry(unit, book, records, field, idOf)
      return null
    case 'delete-entry':
      removeEntry(unit, records, rowOf(field['entry']))
      return null
    case 'flag-person': {
      const entry = rowOf(field['entry'])
      if (entry.payee.trim() === '') throw new StepRefused('That entry has no payee to flag.')
      setPayeeParty(unit, records, entry.payee.trim(), 'person', entry.counterpartyIban)
      return null
    }
    default: {
      if (!isBeforeItems(book.stored)) throw new StepRefused('This file stores entries the current way already.')
      const { leftOut, splitLegs } = moveBlockers(book)
      if (leftOut > 0) throw new StepRefused(`${leftOut} entries or parts need fixing first: the person fixes or deletes what Overview lists as left out of the figures.`)
      if (splitLegs > 0) throw new StepRefused(`${splitLegs} transfers between the person's accounts are split. The person takes the split off them first.`)
      moveToItems(unit, book)
      return null
    }
  }
}
