import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { bankSyncSetUp } from './spendingSettings'
import type { SpendingSettings } from './spendingSettings'
import { sourceOn } from '../../../../shared/app/accountSource'
import type { PeriodSource, SourcePeriod } from '../../../../shared/app/accountSource'
import { fold } from '../../../../shared/text/fold'

/** A current account at a bank, cash in hand, or savings kept apart. */
export const ACCOUNT_KINDS = ['bank', 'cash', 'savings'] as const

export type AccountKind = (typeof ACCOUNT_KINDS)[number]

/** Where a Spending account's rows come from: the bank sync, the bank's statement file, or by hand. Spending reads no mail. */
export const SPENDING_SOURCES = ['bank-link', 'provider-file', 'by-hand'] as const satisfies readonly PeriodSource[]

export type SpendingSource = (typeof SPENDING_SOURCES)[number]

export type SpendingPeriod = SourcePeriod<SpendingSource>

/** One period by hand from the account's start, as cash always has. */
export const BY_HAND_SOURCES: readonly SpendingPeriod[] = [{ source: 'by-hand', from: null }]

/** One of your own accounts in one currency. A card that holds euros and dollars is two accounts. */
export interface Account {
  readonly id: RecordId
  readonly name: string
  readonly kind: AccountKind
  /** The bank's name as the person or a reader wrote it, such as Revolut. Null for cash, and for an account whose bank was left blank. */
  readonly bank: string | null
  readonly currency: CurrencyCode
  /** What the account held at the start of `openedOn`, in its currency. */
  readonly opening: AccountMoney
  readonly openedOn: CivilDate
  /** Where its rows come from, from its start day and then from each later period's day on. Always by hand on cash. */
  readonly sources: readonly SpendingPeriod[]
  /** Blank on cash. */
  readonly iban: string
  /** The last four digits of each card that pays from the account, which a top-up on another account may name in place of an IBAN. Empty on cash. */
  readonly cards: readonly string[]
  readonly closed: boolean
}

/** Whether two accounts, or an account and a recipe, name the same bank, ignoring case, accents and spacing as the bank field does. Two blanks are the same. */
export function sameBank(one: string | null, other: string | null): boolean {
  return fold(one ?? '') === fold(other ?? '')
}

/** What a new account holds unless a person sets it: open, with no card. */
export const NEW_ACCOUNT_DEFAULTS: Pick<Account, 'closed' | 'cards'> = { closed: false, cards: [] }

/** The cards typed or stored as a list, such as `3670, 1234`, each once in the order given, or null when an entry is not four digits. Blank text is no card. */
export function cardsOfText(text: string): readonly string[] | null {
  const entries = text.split(/[\s,;]+/).filter((entry) => entry !== '')
  return entries.every((entry) => /^\d{4}$/.test(entry)) ? [...new Set(entries)] : null
}

/** The cards as a field holds them and `cardsOfText` reads them back. */
export function cardsText(cards: readonly string[]): string {
  return cards.join(', ')
}

/** How an account reads that does not say how its rows come in: by its bank when it is not cash and has an IBAN, since the bank sync finds an account by its IBAN, and by hand otherwise. */
export function sourceOfDetails(account: Pick<Account, 'kind' | 'iban'>): SpendingSource {
  return account.kind !== 'cash' && account.iban !== '' ? 'bank-link' : 'by-hand'
}

/** Where the account's rows come from on the day. A day before its start reads as its first period. */
export function sourceOfDay(account: Pick<Account, 'sources'>, day: CivilDate): SpendingSource {
  return sourceOn(account.sources, day) ?? account.sources[0]?.source ?? 'by-hand'
}

/** Whether a person's own rows may go on the account on the day. A day the bank or its statement file fills takes no typed, copied or receipt's row. */
export function takesRowsByHand(account: Pick<Account, 'sources'>, day: CivilDate): boolean {
  return sourceOfDay(account, day) === 'by-hand'
}

/** Whether a new typed row of the day may go on the account: it is open and its rows of that day come by hand. */
export function takesNewRowsByHand(account: Pick<Account, 'closed' | 'sources'>, day: CivilDate): boolean {
  return !account.closed && takesRowsByHand(account, day)
}

/** Whether the bank sync brings the account's rows on some days. */
export function bankLinked(account: Pick<Account, 'sources'>): boolean {
  return account.sources.some((period) => period.source === 'bank-link')
}

/** Whether the account says the bank brings its rows but holds no IBAN to find it by, which a write refuses and a reading doubts. */
export function bankLinkWithoutIban(account: Pick<Account, 'sources' | 'iban'>): boolean {
  return bankLinked(account) && account.iban.trim() === ''
}

/** Whether a person may have the bank sync bring an account's rows: never on cash, and only once the bank sync is set up, unless the account takes them from the bank already. */
export function bankLinkOffered(kind: AccountKind, before: Pick<Account, 'sources'> | null, settings: Pick<SpendingSettings, 'bankSyncApplication'>): boolean {
  return kind !== 'cash' && (bankSyncSetUp(settings) || (before !== null && bankLinked(before)))
}

/** Why an account cannot take its rows from where a person said: a bank link not offered to it, or one with no IBAN, since the bank sync finds an account by its IBAN. */
export type SourcesRefusal = 'bank-link-not-offered' | 'bank-link-without-iban'

/** Why the account as a person typed it cannot take its rows from where it says, or null when it can. `before` is the account as the file has it, or null for a new one. */
export function sourcesRefusal(
  account: Pick<Account, 'kind' | 'iban' | 'sources'>,
  before: Pick<Account, 'sources'> | null,
  settings: Pick<SpendingSettings, 'bankSyncApplication'>,
): SourcesRefusal | null {
  if (!bankLinked(account)) return null
  if (!bankLinkOffered(account.kind, before, settings)) return 'bank-link-not-offered'
  return bankLinkWithoutIban(account) ? 'bank-link-without-iban' : null
}

/**
 * Whether the day is before the account's start day. Kuna keeps no row of an account from before it, so such a row or bank
 * row on hold counts nowhere, and a write may not add one.
 */
export function beforeStartDay(account: Pick<Account, 'openedOn'>, day: CivilDate): boolean {
  return day < account.openedOn
}

/** The open cash accounts in the currency that a row of the day can go on. */
export function cashAccountsOn(accounts: readonly Account[], currency: CurrencyCode, day: CivilDate): readonly Account[] {
  return accounts.filter((account) => account.kind === 'cash' && !account.closed && account.currency === currency && !beforeStartDay(account, day))
}
