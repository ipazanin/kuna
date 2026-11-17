import type { Transaction } from './workbook'

/** The label a camt statement's rows carry in the statement column: the statement's creation day and its legal sequence number. */
export function camtStatementLabel(created: string, sequence: string): string {
  return `${created}-statement-${sequence.padStart(3, '0')}`
}

const CAMT_LABEL = /^\d{4}-\d{2}-\d{2}-statement-\d{3,}$/

/** What starts the reference of an entry read off a printed statement, so it is never taken for a bank's reference or a table's key. */
export const TRANSCRIBED_PREFIX = 'read-'

export function isTranscribedReference(reference: string): boolean {
  return reference.startsWith(TRANSCRIBED_PREFIX)
}

/**
 * Whether the ledger row came from the bank's own camt statement, by the folder, Import or the chat. A bank sheet's row,
 * labelled with its file name, and a row copied off a page are by hand.
 */
export function isBankStatementRow(row: Pick<Transaction, 'statement' | 'reference'>): boolean {
  return CAMT_LABEL.test(row.statement) && !isTranscribedReference(row.reference)
}
