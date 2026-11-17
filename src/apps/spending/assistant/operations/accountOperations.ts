import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, flagOf, found, inputOf } from '../../../../shared/app/operationInput'
import { ACCOUNT_WRITES, changeAccount, keptAccount, newAccount } from '../../accounts/application/accountWrites'
import { startDayMove } from '../../accounts/domain/startDayMove'
import type { StartDayMove } from '../../accounts/domain/startDayMove'
import { ACCOUNT_BANKS, ACCOUNT_KINDS, NEW_ACCOUNT_DEFAULTS, ROWS_FROM, beforeStartDay, cardsOfText, rowsFromRefusal } from '../../workbook/domain/account'
import type { Account, AccountBank, AccountKind, RowsFrom, RowsFromRefusal } from '../../workbook/domain/account'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../shared/ai/domain/strictSchema'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

const CARDS_INPUT: StrictSchema = {
  type: ['string', 'null'],
  description:
    'The last four digits of each card that pays from it, separated by commas, such as 3670, 1234. A row on another account that names one, such as Top-Up by *3670, pairs as a transfer. "" for no card, or null to leave them.',
}

const ROWS_FROM_ABOUT =
  'rowsFrom is by-hand when the person types its rows, imports its files or adds them through the chat, or bank-link when the bank sync fetches them. Ask the person which. bank-link needs an IBAN and a saved bank sync deployment, which the bank-sync line tells, and cash is always by-hand.'

/** What Accounts does: add, change and delete an account. */
export const ACCOUNT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-account',
    about: `A new account in one currency. kind is bank, cash or savings. bank is otp, revolut, other or null. Cash has no bank and no IBAN. ${ROWS_FROM_ABOUT} openedOn is the day it starts from, and a bank link fetches its rows from that day.`,
    input: inputOf({
      name: TEXT,
      kind: { type: 'string', enum: [...ACCOUNT_KINDS] },
      bank: TEXT_OR_NULL,
      currency: TEXT,
      opening: NUMBER,
      openedOn: TEXT,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      rowsFrom: { type: 'string', enum: [...ROWS_FROM] },
    }),
    refs: {},
    creates: ACCOUNT_RECORDS.name,
    alone: false,
    example: { name: 'Savings', kind: 'savings', bank: null, currency: 'EUR', opening: 100, openedOn: '2026-11-01', iban: null, cards: null, rowsFrom: 'by-hand' },
  },
  {
    name: 'change-account',
    about:
      "A new name, type, bank, currency, opening balance, opening day, IBAN, cards or way its rows come in, or closed or open again. rowsFrom by-hand stops the bank sync reading it, as when its bank link ended. An account with entries keeps its currency. Null leaves a field as it is. A later openedOn deletes the account's entries, receipts and bank rows on hold before it, leaves each transfer's other leg unpaired, and with opening null works out the opening that keeps today's balance. The card shows what goes. An earlier openedOn deletes nothing, and the bank sync reaches back only about 90 days, so older rows come from a statement file.",
    input: inputOf({
      account: TEXT,
      name: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: `${ACCOUNT_KINDS.join(', ')}, or null to leave it.` },
      bank: { type: ['string', 'null'], description: `${ACCOUNT_BANKS.join(', ')}, none for no bank, or null to leave it.` },
      currency: TEXT_OR_NULL,
      opening: NUMBER_OR_NULL,
      openedOn: TEXT_OR_NULL,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      rowsFrom: { type: ['string', 'null'], description: `${ROWS_FROM.join(', ')}, or null to leave it.` },
      closed: FLAG_OR_NULL,
    }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account', name: 'Renamed', kind: null, bank: null, currency: null, opening: 250, openedOn: null, iban: null, cards: '3670', rowsFrom: null, closed: 'yes' },
  },
  {
    name: 'delete-account',
    about: 'Deletes an account no entry is on. One with entries is closed instead.',
    input: inputOf({ account: TEXT }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account-empty' },
  },
]

const ACCOUNT_OPERATION_NAMES: ReadonlySet<string> = new Set(ACCOUNT_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the account operations. */
export function isAccountStep(operation: string): boolean {
  return ACCOUNT_OPERATION_NAMES.has(operation)
}

/** What an account step leaves for the card: the account it added, and the start day move whose losses the card shows. */
export interface AccountStepWritten {
  readonly added: Account | null
  readonly move: StartDayMove | null
}

/** A day on which both accounts were open, as the entry dialog asks. */
export function openedBy(day: CivilDate, accounts: readonly Account[]): CivilDate {
  if (accounts.some((account) => beforeStartDay(account, day))) throw new StepRefused('That day is before the account opened.')
  return day
}

/** Why a step's account cannot take its rows from where it says, in the chat's words. */
function refuseRowsFrom(refusal: RowsFromRefusal | null): void {
  if (refusal === 'bank-link-not-offered') throw new StepRefused('A bank link is for a bank or savings account, once the person saves a bank sync deployment on Settings, Bank sync. Make it by-hand.')
  if (refusal === 'bank-link-without-iban') throw new StepRefused("A bank link needs the account's IBAN, since the bank sync finds the account by it.")
}

/** The cards a step types, or the ones kept on null. */
function typedCards(text: string | null, kept: readonly string[]): readonly string[] {
  if (text === null) return kept
  const cards = cardsOfText(text)
  if (cards === null) throw new StepRefused('Each card is its last four digits, separated by commas, such as 3670, 1234.')
  return cards
}

/** Writes an account step through the writes Accounts uses. */
export function writeAccountStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
): AccountStepWritten {
  const accountOf = (value: unknown): Account => found(book.accounts, idOf(value), 'account')
  if (operation === 'add-account') {
    const currency = currencyCodeOf(field['currency'])
    if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
    const typed = {
      name: field['name'],
      kind: field['kind'] as AccountKind,
      bank: choiceOf(ACCOUNT_BANKS, field['bank'], 'bank'),
      currency,
      opening: accountMoneyFromAmount(field['opening']),
      openedOn: dayOf(field['openedOn']),
      iban: (field['iban'] as string | null) ?? '',
      rowsFrom: field['rowsFrom'] as RowsFrom,
      ...NEW_ACCOUNT_DEFAULTS,
      cards: typedCards(field['cards'], NEW_ACCOUNT_DEFAULTS.cards),
    }
    refuseRowsFrom(rowsFromRefusal(typed, null, book.settings))
    const account = newAccount(typed)
    unit.of(ACCOUNT_WRITES).add(account)
    return { added: account, move: null }
  }
  if (operation === 'change-account') {
    const before = accountOf(field['account'])
    const currency = field['currency'] === null ? before.currency : currencyCodeOf(field['currency'])
    if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
    const bank: AccountBank | 'none' | null = choiceOf([...ACCOUNT_BANKS, 'none'], field['bank'], 'bank')
    const move = field['openedOn'] === null ? null : startDayMove(book, before, dayOf(field['openedOn']))
    const kind = choiceOf(ACCOUNT_KINDS, field['kind'], 'kind') ?? before.kind
    const after = {
      ...before,
      name: (field['name'] as string | null) ?? before.name,
      kind,
      bank: bank === null ? before.bank : bank === 'none' ? null : bank,
      currency,
      opening: field['opening'] === null ? (move?.opening ?? before.opening) : accountMoneyFromAmount(field['opening']),
      openedOn: move?.startsOn ?? before.openedOn,
      iban: (field['iban'] as string | null) ?? before.iban,
      cards: typedCards(field['cards'], before.cards),
      rowsFrom: choiceOf(ROWS_FROM, field['rowsFrom'], 'rowsFrom') ?? (kind === 'cash' ? 'by-hand' : before.rowsFrom),
      closed: flagOf(field['closed'], before.closed),
    }
    refuseRowsFrom(rowsFromRefusal(after, before, book.settings))
    changeAccount(unit, records, before, keptAccount(after), move)
    return { added: null, move }
  }
  unit.of(ACCOUNT_WRITES).remove(accountOf(field['account']))
  return { added: null, move: null }
}
