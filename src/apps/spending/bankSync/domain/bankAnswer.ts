import type { LinkableBank } from '../../workbook/domain/spendingSettings'

/** One transaction as the script hands it over, cut down from Enable Banking's `Transaction`. */
export interface BankTransaction {
  /** Enable Banking's `entry_reference`, which stays the same across sessions for one account. Not its `transaction_id`, which may change between two fetches. */
  readonly reference: string | null
  /** A decimal without a sign, as `transaction_amount.amount`. */
  readonly amount: string
  readonly currency: string
  /** `CRDT` or `DBIT`. A row with neither cannot be read. */
  readonly direction: string
  /** Enable Banking's `status`, such as `BOOK` or `PDNG`. */
  readonly status: string
  readonly bookedOn: string | null
  readonly valueOn: string | null
  /** The day of the transaction itself, which a card payment may book days after. */
  readonly madeOn: string | null
  readonly creditorName: string | null
  readonly creditorIban: string | null
  readonly debtorName: string | null
  readonly debtorIban: string | null
  readonly remittance: readonly string[]
  /** Enable Banking's `exchange_rate.exchange_rate`, a decimal such as `1.0850`, or null when the bank gives none. Which rows carry it and which way round it reads are guesses until the first real run. */
  readonly exchangeRate: string | null
}

/** One of the balances a bank states for an account. */
export interface BankBalance {
  /** A decimal, negative for an overdrawn account, or blank if the bank gave none. */
  readonly amount: string
  readonly currency: string
  /** Enable Banking's `balance_type`, such as `ITBD` or `ITAV`. */
  readonly type: string
}

/** One account a session reaches. The fields after `currency` are null in an answer from a script deployed before it returned them. */
export interface LinkedAccount {
  readonly uid: string
  readonly iban: string
  /** `XXX` for a multi-currency account, or one whose bank names no currency. */
  readonly currency: string
  /** The bank's own name for the kind of account, such as a product's name. */
  readonly product: string | null
  /** A description the person or the bank set on the account. */
  readonly details: string | null
  /** Enable Banking's `cash_account_type`, such as `CACC` for a current account or `SVGS` for savings. */
  readonly cashAccountType: string | null
  /** Enable Banking's `usage`, `PRIV` or `ORGA`. */
  readonly usage: string | null
  /** Enable Banking's `identification_hash`, which names the account across sessions when it has no IBAN. */
  readonly identificationHash: string | null
}

/** One bank's approval as the script holds it. */
export interface BankSession {
  /** The bank's name at Enable Banking. */
  readonly bank: string
  /** Enable Banking's session status, such as `AUTHORIZED` or `EXPIRED`, or the script's `FAILED` when it could not ask. */
  readonly status: string
  /** Why the script could not ask, on a `FAILED` session. */
  readonly reason?: string
  readonly accounts: readonly LinkedAccount[]
}

const ENDED_STATUSES: readonly string[] = ['CANCELLED', 'CLOSED', 'EXPIRED', 'INVALID', 'REVOKED']

/** Whether Enable Banking's error says the session is over, which it can before `valid_until`. */
export function namesEndedSession(message: string): boolean {
  return /EXPIRED_SESSION|CLOSED_SESSION/.test(message)
}

/** Whether a bank's approval is over and only linking again brings rows, however long the file says it lasts. */
export function sessionEnded(session: BankSession): boolean {
  return ENDED_STATUSES.includes(session.status) || namesEndedSession(session.reason ?? '')
}

/** Each bank's name in Enable Banking's list of banks. */
export const ENABLE_BANKING_NAMES: Readonly<Record<LinkableBank, string>> = { otp: 'OTP banka', revolut: 'Revolut' }

/** The currency Enable Banking gives an account that holds several, or that names none. */
export const NO_SINGLE_CURRENCY = 'XXX'
