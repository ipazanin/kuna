import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'
import type { TransactionSignals } from '../../workbook/domain/workbook'

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
  | { readonly kind: 'camt'; readonly iban: string; readonly sequence: number }
  | { readonly kind: 'table'; readonly profile: string; readonly fileHash: string }

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

/** A statement read, or why the file's statement cannot be imported. */
export type StatementReading = { readonly statement: ImportedStatement } | { readonly fileName: string; readonly label: string; readonly refusal: string }

/** A file or statement the app will not read, with the reason in words a person can act on. */
export class StatementRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'StatementRefused'
  }
}
