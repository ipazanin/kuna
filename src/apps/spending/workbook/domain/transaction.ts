import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Typed by you, brought by a bank statement, or made from a receipt that no payment matched yet. */
export const TRANSACTION_SOURCES = ['typed', 'statement', 'receipt'] as const

export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

/** Who gave a row its category: you, or one of your rules. Blank on a row waiting on review and on one the file reader or the transfer pairing filed, which a rule change leaves alone. */
export const CATEGORISED_BY = ['person', 'rule'] as const

export type CategorisedBy = (typeof CATEGORISED_BY)[number]

/** Money in or out of one of your accounts, in the account's currency. */
export interface Transaction {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  /** Credits above zero, debits below, never zero. */
  readonly amount: AccountMoney
  /** Who was paid, or who paid you. */
  readonly payee: string
  /** Null while the row waits on review, when it counts nowhere. */
  readonly category: RecordId | null
  readonly note: string
  readonly source: TransactionSource
  /** The other leg of a transfer between your accounts, on another account, which names this row back. */
  readonly pair: RecordId | null
  /** The bank's text for the row, which a typed row has only once a statement filled it. */
  readonly description: string
  /** The other side's IBAN in capitals without spaces, or blank. */
  readonly counterpartyIban: string
  /** Names the row in its statement, once per account, so a later statement skips it. Blank on a row no statement brought. */
  readonly importKey: string
  /** The label of the statement file that brought or filled the row, or blank. */
  readonly statement: string
  /** Null on a row waiting on review, and on one filed by the file reader or the transfer pairing. */
  readonly categorisedBy: CategorisedBy | null
  /** When a move between your own accounts started, which its two legs share: an exchange's or a pocket's. Blank on any other row. */
  readonly movedAt: string
  /** A move to or from a savings pocket, whose other leg is a savings account's. */
  readonly pocket: boolean
}

/** What only a bank statement tells about a row. */
export type BankFacts = Pick<Transaction, 'description' | 'counterpartyIban' | 'importKey' | 'statement' | 'movedAt' | 'pocket'>

/** The bank facts of a row no statement brought. */
export const NO_BANK_FACTS: BankFacts = { description: '', counterpartyIban: '', importKey: '', statement: '', movedAt: '', pocket: false }
