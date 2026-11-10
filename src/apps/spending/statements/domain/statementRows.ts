import type { OpeningEvidence } from '../../accounts/domain/bankOpening'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TwinAnswer, LookAlikes } from '../../../../shared/money/lookAlikeBookings'
import { amountText } from '../../../../shared/storage/domain/recordFields'
import { occurrenceKeys } from '../../../../shared/text/factKey'

/**
 * One row of a statement as a reader hands it to the dry run, on the account the reader found for it, with its import key
 * unique on that account across exports. A reader may file the row itself, as Revolut's does a fee, and leaves `category`
 * null otherwise. It marks a withdrawal where the bank's row type says one.
 */
export type StatementRow = Pick<Transaction, 'account' | 'date' | 'amount' | 'payee' | 'category' | 'description' | 'counterpartyIban' | 'importKey' | 'movedAt' | 'pocket' | 'cashWithdrawal'>

/** What starts the import key of a row the bank sync brought, so the dry run can tell it from a row a file brought. A file's key never starts so. */
export const BANK_SYNC_KEY_PREFIX = 'bank-'

export function isBankSyncKey(importKey: string): boolean {
  return importKey.startsWith(BANK_SYNC_KEY_PREFIX)
}

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
  /** What the reader left out and why. */
  readonly notes: readonly string[]
  /** Set for rows the AI copied off a statement, which are matched against the rows on the file instead of by their keys alone. */
  readonly transcribed?: { readonly lookAlikes: LookAlikes }
  /** What the person said of the file's rows that look like rows Kuna has from another source, by `rowKey`. */
  readonly twinAnswers?: ReadonlyMap<string, TwinAnswer>
}

/** An account a file needs that Kuna does not keep, drafted to start on the earliest day its rows allow, with what its opening is worked out from on a later day. */
export interface DraftedAccount {
  readonly account: Omit<Account, 'id'>
  readonly evidence: OpeningEvidence
}

/**
 * A file a reader could read, or why it could not, with the accounts its rows need that Kuna does not keep, drafted from the
 * file. A file read without them leaves their rows out with a note. A refusal names them when they are why.
 */
export type StatementReading = ({ readonly statement: StatementRows } | { readonly refusal: string }) & { readonly missing: readonly DraftedAccount[] }
