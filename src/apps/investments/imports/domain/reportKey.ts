import { factKey } from '../../../../shared/text/factKey'

/**
 * The key of a row of a rolling report: the recipe, a short hash of its account and the report's own id of the row. It
 * stays the same in every file that gives the row, and the part before the id tells which account's rows these are.
 */
export function reportRowKey(recipe: string, account: string, id: string): string {
  return `${recipe}:${factKey([account])}:${id}`
}

/** What starts the key of a row the AI copied from a file Kuna does not read. */
const TRANSCRIBED = 'transcribed'

/** The key of a row the AI copied: its file, account and day, then its facts with its count among the card's rows with the same facts. */
export function transcribedRowKey(dayScope: string, occurrenceKey: string): string {
  return `${TRANSCRIBED}:${dayScope}:${occurrenceKey}`
}

/** Whether a record's import key came from the portfolio workbook. Its keys hold no colon. */
export function isWorkbookKey(key: string): boolean {
  return !key.includes(':')
}

/** Whether a record's import key came from a rolling report. */
export function isReportKey(key: string): boolean {
  return !isWorkbookKey(key) && !key.startsWith(`${TRANSCRIBED}:`)
}

/** What a key holds before its last colon: a report's recipe and account, so an account known from one row answers for the rest, or a copied row's file, account and day. */
export function accountScopeOf(key: string): string {
  return key.slice(0, key.lastIndexOf(':'))
}
