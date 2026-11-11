import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A current account at a bank, cash in hand, or savings kept apart. */
export const ACCOUNT_KINDS = ['bank', 'cash', 'savings'] as const

export type AccountKind = (typeof ACCOUNT_KINDS)[number]

/** The banks a statement reader knows, and any other. */
export const ACCOUNT_BANKS = ['otp', 'revolut', 'other'] as const

export type AccountBank = (typeof ACCOUNT_BANKS)[number]

/** How an account's rows come in: a bank link fetches them, and by hand covers typing, the chat and files. */
export const ROWS_FROM = ['bank-link', 'by-hand'] as const

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
  /** Blank on cash. */
  readonly iban: string
  readonly closed: boolean
}

/** What a new account holds unless a person sets it: open. */
export const NEW_ACCOUNT_DEFAULTS: Pick<Account, 'closed'> = { closed: false }

/** How an account reads that does not say how its rows come in: by its bank when it is not cash and has an IBAN, since the bank sync finds an account by its IBAN, and by hand otherwise. A write keeps an account by hand whenever this says so. */
export function rowsFromOfDetails(account: Pick<Account, 'kind' | 'iban'>): RowsFrom {
  return account.kind !== 'cash' && account.iban !== '' ? 'bank-link' : 'by-hand'
}

/**
 * Whether the day is before the account's start day. Kuna keeps no row of an account from before it, so such a row or bank
 * row on hold counts nowhere, and a write may not add one.
 */
export function beforeStartDay(account: Pick<Account, 'openedOn'>, day: CivilDate): boolean {
  return day < account.openedOn
}
