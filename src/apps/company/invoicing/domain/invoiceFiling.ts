import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { FilingPath } from '../../documents/domain/filingPath'
import { unknownTokensIn } from './templateTokens'
import { words } from './words'

/** Where the invoice generator filed each invoice, under the invoice folder. */
export const DEFAULT_FILE_PATH = '{yyyy}/{yyyy}-{mm}/{yyyy}-{mm}-{client}-invoice.pdf'

const PATH_TOKENS = ['{yyyy}', '{yy}', '{mm}', '{client}', '{number}'] as const

/** Null when the pattern names a PDF, with no blank folder and no word in braces the app does not fill in. */
export function filePathProblem(pattern: string): string | null {
  const unknown = unknownTokensIn(pattern, PATH_TOKENS)
  if (unknown.length > 0) return words.unknownTokens(unknown, PATH_TOKENS)
  if (!pattern.trim().toLowerCase().endsWith('.pdf')) return words.pathEndsInPdf
  if (pattern.split('/').some((segment) => segment.trim() === '')) return words.blankFolder
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
