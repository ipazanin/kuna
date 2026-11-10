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
  /** Blank on cash. */
  readonly iban: string
  readonly closed: boolean
}

/** What a new account holds unless a person sets it: open. */
export const NEW_ACCOUNT_DEFAULTS: Pick<Account, 'closed'> = { closed: false }
