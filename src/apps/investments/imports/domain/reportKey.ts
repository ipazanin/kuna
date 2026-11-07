import { factKey } from '../../../../shared/text/factKey'

/**
 * The key of a row of a rolling report: the recipe, a short hash of its account and the report's own id of the row. It
 * stays the same in every file that gives the row, and the part before the id tells which account's rows these are.
 */
export function reportRowKey(recipe: string, account: string, id: string): string {
  return `${recipe}:${factKey([account])}:${id}`
}

/** Whether a record's import key came from a rolling report. A workbook's keys hold no colon. */
export function isReportKey(key: string): boolean {
  return key.includes(':')
}

/** The recipe and the account of a report's key, so an account known from one row answers for the rest. */
export function accountScopeOf(key: string): string {
  return key.slice(0, key.lastIndexOf(':'))
}
