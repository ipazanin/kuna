import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { SpendingSettings } from './spendingSettings'
import type { AccountSource, ExtraOrigin } from '../../../../shared/app/accountSource'

/** A current account at a bank, cash in hand, or savings kept apart. */
export const ACCOUNT_KINDS = ['bank', 'cash', 'savings'] as const

export type AccountKind = (typeof ACCOUNT_KINDS)[number]

/** The banks a statement reader knows, and any other. */
export const ACCOUNT_BANKS = ['otp', 'revolut', 'other'] as const

export type AccountBank = (typeof ACCOUNT_BANKS)[number]

/** The ways a Spending account's rows come in. Spending reads no mail. */
export const ROWS_FROM = ['bank-link', 'by-hand'] as const satisfies readonly AccountSource[]

export type RowsFrom = (typeof ROWS_FROM)[number]

/** One of your own accounts in one currency. A card that holds euros and dollars is two accounts. */
export interface Account {
  readonly id: RecordId
  readonly name: string
  readonly kind: AccountKind
  /** Null for cash, and for an account whose bank was left blank. */
  readonly bank: AccountBank | null
  readonly currency: CurrencyCode
  /** What the account held at the start of `openedOn`, in its currency. */
  readonly opening: AccountMoney
  readonly openedOn: CivilDate
  /** Always by hand on cash. */
  readonly rowsFrom: RowsFrom
  /** What else an account the bank fills takes rows from, such as the bank's statement file for days a lapsed link missed. Empty on one kept by hand. */
  readonly alsoFrom: readonly ExtraOrigin[]
  /** Blank on cash. */
  readonly iban: string
  /** The last four digits of each card that pays from the account, which a top-up on another account may name in place of an IBAN. Empty on cash. */
  readonly cards: readonly string[]
  readonly closed: boolean
}

/** What a new account holds unless a person sets it: open, with no card. */
export const NEW_ACCOUNT_DEFAULTS: Pick<Account, 'closed' | 'cards' | 'alsoFrom'> = { closed: false, cards: [], alsoFrom: [] }

/** The cards typed or stored as a list, such as `3670, 1234`, each once in the order given, or null when an entry is not four digits. Blank text is no card. */
export function cardsOfText(text: string): readonly string[] | null {
  const entries = text.split(/[\s,;]+/).filter((entry) => entry !== '')
  return entries.every((entry) => /^\d{4}$/.test(entry)) ? [...new Set(entries)] : null
}

/** The cards as a field holds them and `cardsOfText` reads them back. */
export function cardsText(cards: readonly string[]): string {
  return cards.join(', ')
}

/** How an account reads that does not say how its rows come in: by its bank when it is not cash and has an IBAN, since the bank sync finds an account by its IBAN, and by hand otherwise. A write keeps an account by hand whenever this says so. */
export function rowsFromOfDetails(account: Pick<Account, 'kind' | 'iban'>): RowsFrom {
  return account.kind !== 'cash' && account.iban !== '' ? 'bank-link' : 'by-hand'
}

/** Whether a person's own rows may go on the account. One the bank fills takes no typed, copied or receipt's row on any day. */
export function takesRowsByHand(account: Pick<Account, 'rowsFrom'>): boolean {
  return account.rowsFrom === 'by-hand'
}

/** Whether a new typed row may go on the account: it is open and its rows come by hand. */
export function takesNewRowsByHand(account: Pick<Account, 'closed' | 'rowsFrom'>): boolean {
  return !account.closed && takesRowsByHand(account)
}

/** Whether the account says the bank brings its rows but holds no IBAN to find it by, which a write refuses and a reading doubts. */
export function bankLinkWithoutIban(account: Pick<Account, 'rowsFrom' | 'iban'>): boolean {
  return account.rowsFrom === 'bank-link' && account.iban.trim() === ''
}

/** Whether a person may have the bank sync bring an account's rows: never on cash, and only once a bank sync deployment is saved, unless the account takes them from the bank already. */
export function bankLinkOffered(kind: AccountKind, before: Pick<Account, 'rowsFrom'> | null, settings: Pick<SpendingSettings, 'bankSyncDeployment'>): boolean {
  return kind !== 'cash' && (settings.bankSyncDeployment !== '' || before?.rowsFrom === 'bank-link')
}

/** Why an account cannot take its rows from where a person said: a bank link not offered to it, or one with no IBAN, since the bank sync finds an account by its IBAN. */
export type RowsFromRefusal = 'bank-link-not-offered' | 'bank-link-without-iban'

/** Why the account as a person typed it cannot take its rows from where it says, or null when it can. `before` is the account as the file has it, or null for a new one. */
export function rowsFromRefusal(
  account: Pick<Account, 'kind' | 'iban' | 'rowsFrom'>,
  before: Pick<Account, 'rowsFrom'> | null,
  settings: Pick<SpendingSettings, 'bankSyncDeployment'>,
): RowsFromRefusal | null {
  if (account.rowsFrom === 'by-hand') return null
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
