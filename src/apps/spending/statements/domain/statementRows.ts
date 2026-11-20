import type { FileHolding } from './fileHoldings'
import type { OpeningEvidence } from '../../accounts/domain/bankOpening'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { TwinAnswer, LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import { occurrenceKeys } from '../../../../shared/text/factKey'

/**
 * One row of a statement as a reader hands it to the dry run, on the account the reader found for it, with its import key
 * unique on that account across exports. A reader may file the row itself, as Revolut's does a fee, and leaves `category`
 * null otherwise. It marks a withdrawal where the bank's row type says one, and a row the bank has not booked yet.
 */
export type StatementRow = Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'description' | 'counterpartyIban' | 'importKey' | 'movedAt' | 'pocket' | 'cashWithdrawal' | 'pending'> & {
  readonly category: RecordId | null
}

/** What starts the import key of a row the bank sync brought, so the dry run can tell it from a row a file brought. A file's key never starts so. */
export const BANK_SYNC_KEY_PREFIX = 'bank-'

export function isBankSyncKey(importKey: string): boolean {
  return importKey.startsWith(BANK_SYNC_KEY_PREFIX)
}

/** The first fact of the key of a row the bank has not booked yet, so its key never equals a booked row's and the booked rows keep theirs. */
export const PENDING_KEY_FACT = 'pending'

/** What starts the import key of a row read off a printed statement, so it is never taken for a file's or the bank sync's key. */
const TRANSCRIBED_KEY_PREFIX = 'read-'

export function isTranscribedKey(importKey: string): boolean {
  return importKey.startsWith(TRANSCRIBED_KEY_PREFIX)
}

/** Where a row came from, by its key: the AI copied it, the bank sync brought it, or a file Kuna read did. */
export function rowSource(importKey: string): 'copied' | 'sync' | 'file' {
  return isTranscribedKey(importKey) ? 'copied' : isBankSyncKey(importKey) ? 'sync' : 'file'
}

/**
 * Import keys for rows read off a printed statement, in the statement's order: its account, day and amount, with the count
 * among equal rows before it. The payee stays out, as two reads of one page spell it differently. Reading the same statement
 * again gives the same keys, so its rows are skipped.
 */
export function transcribedImportKeys(rows: readonly Pick<StatementRow, 'account' | 'date' | 'amount'>[]): string[] {
  return occurrenceKeys(rows.map((row) => [row.account, row.date, amountText(row.amount)])).map((key) => `${TRANSCRIBED_KEY_PREFIX}${key}`)
}

/** What any bank's reader makes of a file, which is all the dry run knows of the bank. */
export interface StatementRows {
  /** The label each row of the file carries. */
  readonly label: string
  readonly rows: readonly StatementRow[]
  /** What the reader left out of the file or noticed in it. */
  readonly fileNotes: readonly FileNote[]
  /** Set for rows the AI copied off a statement, which are matched against the rows on the file instead of by their keys alone. */
  readonly transcribed?: { readonly lookAlikes: LookAlikes }
  /** What the person said of the file's rows that look like rows Kuna has from another source, by `rowKey`. */
  readonly twinAnswers?: ReadonlyMap<string, TwinAnswer>
  /**
   * The days the person said the file brings, such as a gap the bank sync left. Its rows on other days are left out, and its rows
   * on these days are matched row by row against the rows of the other sources, whichever days the sync covers.
   */
  readonly days?: DateRange | undefined
  /**
   * The days the reader saw whole on each account, such as the days a bank sync asked for. A row the bank has not booked yet
   * that is on the file for one of these days, and that the statement neither brings again nor books, is gone. Left out, nothing goes.
   */
  readonly covers?: ReadonlyMap<RecordId, DateRange>
}

/**
 * What a reader left out or noticed, as facts the screens word: rows of a state or a product Kuna does not read, savings rows
 * with no account, a product whose last balance its rows do not reach, and the bank sync's rows of zero, rows it could not
 * read, a balance it could not read and rows in a currency no account keeps.
 */
export type FileNote =
  | { readonly kind: 'not-completed'; readonly count: number }
  | { readonly kind: 'savings-left-out'; readonly count: number; readonly currencies: readonly string[] }
  | { readonly kind: 'other-product'; readonly count: number; readonly product: string }
  | { readonly kind: 'balance-differs'; readonly savings: boolean; readonly currency: CurrencyCode; readonly balance: AccountMoney; readonly worked: AccountMoney }
  | { readonly kind: 'zero-left-out'; readonly count: number; readonly account: string }
  | { readonly kind: 'unreadable-left-out'; readonly count: number; readonly account: string }
  | { readonly kind: 'balance-not-read'; readonly accounts: string; readonly reason: string }
  | { readonly kind: 'other-currency-left-out'; readonly count: number; readonly currency: string }

/**
 * Why a reader read nothing of a file: it lacks a column, a row on a line of the file cannot be read or is no kind the reader
 * knows, a row's currency is no currency code, two open accounts could take a currency's rows, accounts it needs are missing, or
 * no recipe reads the file, with the column each recipe lacks.
 */
export type StatementRefusal =
  | { readonly kind: 'no-column'; readonly column: string }
  | { readonly kind: 'unreadable'; readonly line: number; readonly column: string; readonly text: string; readonly reads: 'day' | 'amount' | 'text' }
  | { readonly kind: 'no-kind'; readonly line: number }
  | { readonly kind: 'not-a-currency'; readonly line: number; readonly text: string }
  | { readonly kind: 'many-accounts'; readonly bank: string; readonly names: readonly string[]; readonly currency: string }
  | { readonly kind: 'missing-accounts' }
  | { readonly kind: 'no-recipe'; readonly misses: readonly { readonly recipe: string; readonly column: string }[] }

/** An account a file needs that Kuna does not keep, drafted to start on the earliest day its rows allow, with what its opening is worked out from on a later day. */
export interface DraftedAccount {
  readonly account: Omit<Account, 'id'>
  readonly evidence: OpeningEvidence
}

/**
 * A file a reader could read, or why it could not, with the accounts its rows need that Kuna does not keep, drafted from the
 * file. A file read without them leaves their rows out with a note. A refusal names them when they are why.
 */
export type StatementReading = ({ readonly statement: StatementRows } | { readonly refused: StatementRefusal }) & {
  readonly missing: readonly DraftedAccount[]
  /** What the file holds of each product and currency, empty when it was refused before its rows were read. */
  readonly holdings: readonly FileHolding[]
}
