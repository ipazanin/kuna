import { FLAG_OR_NULL, NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, choiceOf, dayOf, flagOf, found, inputOf } from '../../../../shared/app/operationInput'
import { ACCOUNT_WRITES, changeAccount, keptAccount, newAccount } from '../../accounts/application/accountWrites'
import { startDayMove } from '../../accounts/domain/startDayMove'
import type { StartDayMove } from '../../accounts/domain/startDayMove'
import { sourceHandover } from '../../accounts/domain/sourceHandover'
import type { SourceHandover } from '../../accounts/domain/sourceHandover'
import { periodsOfText } from '../../../../shared/app/accountSource'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { ACCOUNT_KINDS, BY_HAND_SOURCES, NEW_ACCOUNT_DEFAULTS, SPENDING_SOURCES, beforeStartDay, cardsOfText, sourcesRefusal } from '../../workbook/domain/account'
import type { Account, AccountKind, SourcesRefusal, SpendingPeriod } from '../../workbook/domain/account'
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

const SOURCES_ABOUT =
  "Each day of an account takes its new rows from one source: by-hand when the person types them or adds them through the chat, provider-file when they import the bank's statement files, or bank-link when the bank sync fetches them. Ask the person which. bank-link needs an IBAN and the bank sync set up, which the bank-sync line tells, and cash is always by-hand. A day of provider-file or bank-link takes no typed, copied or receipt's row, and a receipt there waits for that source's row."

/** What Accounts does: add, change and delete an account. */
export const ACCOUNT_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-account',
    about: `A new account in one currency. kind is bank, cash or savings. bank is the bank's name as the person writes it, such as Revolut or OTP banka, or null for none. Cash has no bank and no IBAN. ${SOURCES_ABOUT} sources lists them in order from openedOn on, each later one with the day it takes over, such as provider-file, bank-link 2026-06-01, and null is by-hand. A bank link fetches its rows from the day its source starts.`,
    input: inputOf({
      name: TEXT,
      kind: { type: 'string', enum: [...ACCOUNT_KINDS] },
      bank: TEXT_OR_NULL,
      currency: TEXT,
      opening: NUMBER,
      openedOn: TEXT,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      sources: { type: ['string', 'null'], description: `${SPENDING_SOURCES.join(', ')}, each later one followed by its day, or null for by-hand.` },
    }),
    refs: {},
    creates: ACCOUNT_RECORDS.name,
    alone: false,
    example: { name: 'Savings', kind: 'savings', bank: null, currency: 'EUR', opening: 100, openedOn: '2026-11-01', iban: null, cards: null, sources: null },
  },
  {
    name: 'change-account',
    about:
      "A new name, type, bank, currency, opening balance, opening day, IBAN, cards or sources of its rows, or closed or open again. sources lists them all as add-account does, such as by-hand, bank-link 2026-12-01 for a bank link from a day on, or bank-link, provider-file 2026-03-10, bank-link 2026-03-21 to give the days a lapsed bank link missed to the statement file. The rows another source brought on the days it gives away go, with what the card lists, and the new source brings its own. Undo puts them back until it does. An account with entries keeps its currency. Null leaves a field as it is. A later openedOn deletes the account's entries, receipts and bank rows on hold before it, leaves each transfer's other leg unpaired, and with opening null works out the opening that keeps today's balance. The card shows what goes. An earlier openedOn deletes nothing, and the bank sync reaches back only about 90 days, so older rows come from a statement file.",
    input: inputOf({
      account: TEXT,
      name: TEXT_OR_NULL,
      kind: { type: ['string', 'null'], description: `${ACCOUNT_KINDS.join(', ')}, or null to leave it.` },
      bank: { type: ['string', 'null'], description: "The bank's name, such as Revolut, none for no bank, or null to leave it." },
      currency: TEXT_OR_NULL,
      opening: NUMBER_OR_NULL,
      openedOn: TEXT_OR_NULL,
      iban: TEXT_OR_NULL,
      cards: CARDS_INPUT,
      sources: { type: ['string', 'null'], description: `${SPENDING_SOURCES.join(', ')}, each later one followed by its day, or null to leave them.` },
      closed: FLAG_OR_NULL,
    }),
    refs: { account: ACCOUNT_RECORDS.name },
    creates: null,
    alone: false,
    example: { account: 'account', name: 'Renamed', kind: null, bank: null, currency: null, opening: 250, openedOn: null, iban: null, cards: '3670', sources: null, closed: 'yes' },
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

/** What an account step leaves for the card: the account it added, and the start day move and source handover whose losses the card shows. */
export interface AccountStepWritten {
  readonly added: Account | null
  readonly move: StartDayMove | null
  readonly handover: SourceHandover | null
}

/** A day on which both accounts were open, as the entry dialog asks. */
export function openedBy(day: CivilDate, accounts: readonly Account[]): CivilDate {
  if (accounts.some((account) => beforeStartDay(account, day))) throw new StepRefused('That day is before the account opened.')
  return day
}

/** A bank's name as the chat wrote it, trimmed, or null for a blank one. */
function bankNameOf(typed: unknown): string | null {
  const name = typeof typed === 'string' ? typed.trim() : ''
  return name === '' ? null : name
}

/** Why a step's account cannot take its rows from where it says, in the chat's words. */
function refuseSources(refusal: SourcesRefusal | null): void {
  if (refusal === 'bank-link-not-offered') throw new StepRefused('A bank link is for a bank or savings account, once the person brings an Enable Banking key on Settings, Bank sync. Make it by-hand.')
  if (refusal === 'bank-link-without-iban') throw new StepRefused("A bank link needs the account's IBAN, since the bank sync finds the account by it.")
}

/** The sources a step lists, by hand when it lists none. */
function typedSources(text: string | null): readonly SpendingPeriod[] {
  if (text === null) return BY_HAND_SOURCES
  return (
    periodsOfText(text, SPENDING_SOURCES, parseCivilDate) ??
    refused(`Write the sources as ${SPENDING_SOURCES.join(', ')} in order, each later one followed by the day it takes over, such as provider-file, bank-link 2026-06-01.`)
  )
}

function refused(reason: string): never {
  throw new StepRefused(reason)
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
      bank: bankNameOf(field['bank']),
      currency,
      opening: accountMoneyFromAmount(field['opening']),
      openedOn: dayOf(field['openedOn']),
      iban: (field['iban'] as string | null) ?? '',
      sources: typedSources(field['sources']),
      ...NEW_ACCOUNT_DEFAULTS,
      cards: typedCards(field['cards'], NEW_ACCOUNT_DEFAULTS.cards),
    }
    refuseSources(sourcesRefusal(typed, null, book.settings))
    const account = newAccount(typed)
    unit.of(ACCOUNT_WRITES).add(account)
    return { added: account, move: null, handover: null }
  }
  if (operation === 'change-account') {
    const before = accountOf(field['account'])
    const currency = field['currency'] === null ? before.currency : currencyCodeOf(field['currency'])
    if (currency === null) throw new StepRefused('That currency is not one Kuna knows. Write its three-letter ISO code, such as EUR or USD.')
    const typedBank = field['bank'] as string | null
    const move = field['openedOn'] === null ? null : startDayMove(book, before, dayOf(field['openedOn']))
    const kind = choiceOf(ACCOUNT_KINDS, field['kind'], 'kind') ?? before.kind
    const sources = kind === 'cash' ? BY_HAND_SOURCES : field['sources'] === null ? before.sources : typedSources(field['sources'])
    const after = {
      ...before,
      name: (field['name'] as string | null) ?? before.name,
      kind,
      bank: typedBank === null ? before.bank : typedBank.trim() === 'none' ? null : bankNameOf(typedBank),
      currency,
      opening: field['opening'] === null ? (move?.opening ?? before.opening) : accountMoneyFromAmount(field['opening']),
      openedOn: move?.startsOn ?? before.openedOn,
      iban: (field['iban'] as string | null) ?? before.iban,
      cards: typedCards(field['cards'], before.cards),
      sources,
      closed: flagOf(field['closed'], before.closed),
    }
    refuseSources(sourcesRefusal(after, before, book.settings))
    const kept = keptAccount(after)
    const goneBefore = new Set(move?.direction === 'later' ? move.rows : [])
    const handover = sourceHandover({ ...book, transactions: book.transactions.filter((row) => !goneBefore.has(row)) }, before, kept.sources)
    changeAccount(unit, records, before, kept, move, handover)
    return { added: null, move, handover }
  }
  unit.of(ACCOUNT_WRITES).remove(accountOf(field['account']))
  return { added: null, move: null, handover: null }
}
