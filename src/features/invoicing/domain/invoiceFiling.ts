import type { CivilDate } from '../../../shared/calendar/civilDate'

/** Where the invoice generator filed each invoice, under the invoice folder. */
export const DEFAULT_FILE_PATH = '{yyyy}/{yyyy}-{mm}/{yyyy}-{mm}-{client}-invoice.pdf'

const PATH_TOKENS = ['{yyyy}', '{yy}', '{mm}', '{client}', '{number}'] as const

const TOKEN = /\{[^}]*\}/g

/** The folders under the invoice folder, outermost first, and the file's name in the last of them. */
export interface FilingPath {
  readonly folders: readonly string[]
  readonly fileName: string
}

/** Null when the pattern names a PDF, with no blank folder and no word in braces the app does not fill in. */
export function filePathProblem(pattern: string): string | null {
  const unknown = (pattern.match(TOKEN) ?? []).filter((token) => !(PATH_TOKENS as readonly string[]).includes(token))
  if (unknown.length > 0) return `${unknown.join(', ')} is not one of ${PATH_TOKENS.join(', ')}`
  if (!pattern.trim().toLowerCase().endsWith('.pdf')) return 'the path ends in a file name such as {yyyy}-{mm}-{client}-invoice.pdf'
  if (pattern.split('/').some((segment) => segment.trim() === '')) return 'a folder name between two slashes is blank'
  return null
}

/** The pattern filled in for one invoice, its dates from the issue date. A slash in the number would make a folder, so it becomes a hyphen. */
export function filingPathOf(pattern: string, invoice: { readonly issued: CivilDate; readonly client: string; readonly number: string }): FilingPath {
  const [year, month] = invoice.issued.split('-') as [string, string]
  const filled = pattern
    .trim()
    .replaceAll('{yyyy}', year)
    .replaceAll('{yy}', year.slice(2))
    .replaceAll('{mm}', month)
    .replaceAll('{client}', invoice.client)
    .replaceAll('{number}', invoice.number.trim().replaceAll('/', '-'))
  const segments = filled.split('/').map((segment) => segment.trim())
  return { folders: segments.slice(0, -1), fileName: segments[segments.length - 1]! }
}

/** The path as a person reads it, such as 2026/2026-10/2026-10-acme-invoice.pdf. */
export function pathInWords(path: FilingPath): string {
  return [...path.folders, path.fileName].join('/')
}
