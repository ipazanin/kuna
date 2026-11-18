import type { AskedRow } from '../../../../shared/recipes/domain/runRecipe'
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

/** Where a key came from: the portfolio workbook, a row the AI copied, or a report by its recipe's id, the part before its first colon. */
export function sourceOfKey(key: string): string {
  if (isWorkbookKey(key)) return 'workbook'
  return key.slice(0, key.indexOf(':'))
}

/** Whether any of a record's keys came from a rolling report, mailed or uploaded. */
export function holdsReportKey(keys: readonly string[]): boolean {
  return keys.some(isReportKey)
}

/** A record's keys with `key` in place of the one from the same source, or added beside the others when it has none from there. A record keeps one key per source. */
export function withImportKey(keys: readonly string[], key: string): string[] {
  const source = sourceOfKey(key)
  return keys.some((kept) => sourceOfKey(kept) === source) ? keys.map((kept) => (sourceOfKey(kept) === source ? key : kept)) : [...keys, key]
}

/** What a booked question's key holds after its recipe, so it reads as a report key and tells itself from a row's. */
const ASKED = 'asked'

/**
 * The key a record booked from a question of a report keeps, so the question goes once the record is saved: the changed
 * row's own key, or `<recipe>:asked:<question key>` for a row the recipe would not read. Either reads as the report's key,
 * so the mail lets it land on an account it fills and no workbook import lists it as gone.
 */
export function bookingKey(recipe: string, question: Pick<AskedRow, 'key' | 'why'>): string {
  return question.why.kind === 'changed' ? question.key : `${recipe}:${ASKED}:${question.key}`
}

/** Whether a key is a booked question's, which names no account of the report and no row it reads. */
export function isAskedKey(key: string): boolean {
  return key.split(':')[1] === ASKED
}
