import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { addMoney } from '../../../../shared/money/money'
import type { TransactionSignals } from '../../../../shared/categorising/domain/transactionFacts'
import { occurrenceKeys } from '../../../../shared/text/factKey'
import { statementTies, tieRefusal } from './statementTies'

/** The bank's codes of a row whose file gives none. */
export const NO_SIGNALS: TransactionSignals = { purpose: '', txDomain: '', txFamily: '', txSubFamily: '', creditorReference: '', instructedCurrency: '' }

/** One booked entry of a statement, as the ledger will hold it. */
export interface ImportedRow {
  readonly date: CivilDate
  /** Credits positive. */
  readonly amount: Money
  /** The account's balance after the entry, or null when the file gives none and it is worked out on import. */
  readonly balance: Money | null
  readonly counterparty: string
  /** As the file gives it. */
  readonly counterpartyIban: string
  readonly description: string
  /** The bank's own reference, or a key worked out from the row when the file has none. Blank only when neither exists. */
  readonly reference: string
  readonly signals: TransactionSignals
  /** Why a person should look at the row, such as a reversal. */
  readonly reviewReasons: readonly string[]
}

/** Where a statement came from and which one it is. */
export type StatementSource =
  { readonly kind: 'camt'; readonly iban: string; readonly sequence: number } | { readonly kind: 'table'; readonly profile: string; readonly fileHash: string } | { readonly kind: 'transcribed' }

/** One statement read from a file: an account's entries in booking order, oldest first. */
export interface ImportedStatement {
  readonly fileName: string
  readonly source: StatementSource
  /** What the ledger's `statement` column says for its rows. */
  readonly label: string
  readonly account: string
  /** The balance before the first entry, or null when the file gives no balances. */
  readonly opening: Money | null
  readonly closing: Money | null
  readonly rows: readonly ImportedRow[]
  /** What the reader noticed that does not stop the import, each a sentence. */
  readonly notes: readonly string[]
}

/** An account a statement's IBAN names that the accounts tab lacks, which the person can add as the statement is imported. */
export interface NewAccountOffer {
  /** Normalised. */
  readonly iban: string
  /** The account's ISO 4217 code, as the statement states it. */
  readonly currency: string
}

/**
 * A statement read, or why the file's statement cannot be imported. A statement of an IBAN the
 * accounts tab lacks is read with a blank account and the account it offers to add.
 */
export type StatementReading =
  | { readonly statement: ImportedStatement }
  | { readonly statement: ImportedStatement; readonly newAccount: NewAccountOffer }
  | { readonly fileName: string; readonly label: string; readonly refusal: string }

/** A file or statement the app will not read, with the reason in words a person can act on. */
export class StatementRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'StatementRefused'
  }
}

/** What starts the reference of an entry read off a printed statement, so it is never taken for a bank's reference or a table's key. */
const TRANSCRIBED_PREFIX = 'read-'

/**
 * References for entries read off a printed statement, in the statement's order: its account, day and amount, with the count
 * among equal entries before it. The counterparty stays out, as two reads of one page spell it differently. Reading the same
 * statement again gives the same references, so its entries are skipped.
 */
export function transcribedReferences(account: string, rows: readonly Pick<ImportedRow, 'date' | 'amount'>[]): string[] {
  return occurrenceKeys(rows.map((row) => [account, row.date, String(row.amount)])).map((key) => `${TRANSCRIBED_PREFIX}${key}`)
}

/** An entry as read off a printed statement. */
export type TranscribedRow = Pick<ImportedRow, 'date' | 'amount' | 'counterparty' | 'counterpartyIban' | 'description'>

/**
 * A statement read off a page, its entries oldest first, each with the balance it leaves from the printed opening. It is refused
 * unless its entries lead from the printed opening to the printed closing balance, since nothing is filled in to close the gap.
 */
export function transcribedStatement(account: string, label: string, opening: Money, closing: Money, rows: readonly TranscribedRow[]): ImportedStatement {
  const tie = statementTies({ opening, amounts: rows.map((row) => row.amount), closing })
  if (tie.kind === 'off') throw new StatementRefused(tieRefusal(tie))
  const references = transcribedReferences(account, rows)
  let balance = opening
  const entries = rows.map((row, at): ImportedRow => {
    balance = addMoney(balance, row.amount)
    return { ...row, balance, reference: references[at]!, signals: NO_SIGNALS, reviewReasons: [] }
  })
  return { fileName: label, source: { kind: 'transcribed' }, label, account, opening, closing, rows: entries, notes: [] }
}
