import { SUGGESTION_KINDS } from '../domain/dismissals'
import type { Dismissal } from '../domain/dismissals'
import { inTabOrder, isUnreadable, optionalDate, readRow, refuse, requiredChoice, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The `dismissed` tab. A suggestion dismissed twice is left out the second time, since one row already hides it. */
export function readDismissals(rows: readonly SheetRow[]): TabReading<Dismissal> {
  const facts: Dismissal[] = []
  const problems: RowProblem[] = []
  const seen = new Set<string>()
  for (const row of inTabOrder(rows)) {
    const dismissal = readRow(() => readDismissalRow(row))
    if (isUnreadable(dismissal)) {
      problems.push({ sheetRow: row.sheetRow, reason: dismissal.unreadable })
    } else if (seen.has(`${dismissal.kind} ${dismissal.key}`)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${dismissal.key} is already dismissed above` })
    } else {
      seen.add(`${dismissal.kind} ${dismissal.key}`)
      facts.push(dismissal)
    }
  }
  return { facts, problems }
}

function readDismissalRow(row: SheetRow): Dismissal {
  const { cells } = row
  const kind = requiredChoice(cells, 'kind', SUGGESTION_KINDS, 'kind of suggestion')
  const key = textOf(cells.key)
  if (key === '') refuse('no key')
  return { kind, key, category: slugOf(cells.category), dismissedOn: optionalDate(cells, 'dismissed_on'), sheetRow: row.sheetRow }
}
