import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RowLink } from './rowLink'

/** Typed by you, brought by a bank statement, or made from a receipt that no payment matched yet. */
export const TRANSACTION_SOURCES = ['typed', 'statement', 'receipt'] as const

export type TransactionSource = (typeof TRANSACTION_SOURCES)[number]

/** Who filed a row's items: you, or one of your rules. Blank on a row waiting on review and on one the file reader or the transfer pairing filed, which a rule change leaves alone. */
export const CATEGORISED_BY = ['person', 'rule'] as const

export type CategorisedBy = (typeof CATEGORISED_BY)[number]

/** Money in or out of one of your accounts, in the account's currency. Its items say what the money is: its category, note and link. */
export interface Transaction {
  readonly id: RecordId
  readonly account: RecordId
  readonly date: CivilDate
  /** Credits above zero, debits below, never zero. */
  readonly amount: AccountMoney
  /** Who was paid, or who paid you. */
  readonly payee: string
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
  /** What the two legs of a move between your own accounts share, an exchange's or a pocket's: the time it started on a file, or both legs' import keys from a bank sync. Blank on any other row. */
  readonly movedAt: string
  /** A move to or from a savings pocket, whose other leg is a savings account's. */
  readonly pocket: boolean
  /** Cash taken out, as the bank's own row type says, whose other leg is a cash account's. */
  readonly cashWithdrawal: boolean
}

/**
 * A row as the file stores it. A file from before items keeps on the row the category, note and link of its one item, and for a
 * row of several the main category, the row's note and its link. A file moved to items leaves them blank.
 */
export interface StoredRow extends Transaction {
  readonly category: RecordId | null
  readonly note: string
  readonly link: RowLink | null
}

/** The row's own category, note and link, which only a file from before items fills. */
export type RowCells = Pick<StoredRow, 'category' | 'note' | 'link'>

/** The cells of a row in a file moved to items. */
export const BLANK_CELLS: RowCells = { category: null, note: '', link: null }

/** The row with these cells, as the file stores it. */
export function storedRowOf(row: Transaction, cells: RowCells): StoredRow {
  const { id, account, date, amount, payee, source, pair, description, counterpartyIban, importKey, statement, categorisedBy, movedAt, pocket, cashWithdrawal } = row
  const { category, note, link } = cells
  return { id, account, date, amount, payee, category, note, source, pair, description, counterpartyIban, importKey, statement, categorisedBy, movedAt, pocket, cashWithdrawal, link }
}

/** What tells a row from every other on the file: its account and its import key. */
export function rowKey(row: Pick<Transaction, 'account' | 'importKey'>): string {
  return `${row.account} ${row.importKey}`
}

/** What only a bank statement tells about a row. */
export type BankFacts = Pick<Transaction, 'description' | 'counterpartyIban' | 'importKey' | 'statement' | 'movedAt' | 'pocket' | 'cashWithdrawal'>

/** The bank facts of a row no statement brought. */
export const NO_BANK_FACTS: BankFacts = { description: '', counterpartyIban: '', importKey: '', statement: '', movedAt: '', pocket: false, cashWithdrawal: false }
