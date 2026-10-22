import { SUGGESTION_KINDS } from '../domain/dismissals'
import type { Dismissal } from '../domain/dismissals'
import { sharedKeys } from '../domain/sharedKeys'
import { isUnreadable, optionalDate, ownIdOf, readRow, refuse, requiredChoice, sharedIds, slugOf, tabReading, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The `dismissed` tab. A suggestion dismissed on more than one row is left out on every one, so it shows again until one row is cleared. */
export function readDismissals(rows: readonly SheetRow[]): TabReading<Dismissal> {
  const read: { readonly row: SheetRow; readonly dismissal: Dismissal }[] = []
  const problems: RowProblem[] = []
  const shared = sharedIds(rows)
  for (const row of rows) {
    const dismissal = readRow(() => readDismissalRow(row, shared))
    if (isUnreadable(dismissal)) {
      problems.push({ sheetRow: row.sheetRow, reason: dismissal.unreadable })
    } else {
      read.push({ row, dismissal })
    }
  }
  const keyOf = (dismissal: Dismissal): string => `${dismissal.kind} ${dismissal.key}`
  const twice = sharedKeys(
    read.map(({ dismissal }) => dismissal),
    keyOf,
  )
  for (const { row, dismissal } of read.filter((candidate) => twice.has(keyOf(candidate.dismissal)))) {
    problems.push({ sheetRow: row.sheetRow, reason: `${dismissal.key} is dismissed on more than one row, so none of them counts` })
  }
  return tabReading(
    'dismissed',
    rows,
    read.map(({ dismissal }) => dismissal).filter((dismissal) => !twice.has(keyOf(dismissal))),
    problems,
  )
}

function readDismissalRow(row: SheetRow, shared: ReadonlySet<string>): Dismissal {
  const { cells } = row
  const kind = requiredChoice(cells, 'kind', SUGGESTION_KINDS, 'kind of suggestion')
  const key = textOf(cells.key)
  if (key === '') refuse('no key')
  return { kind, key, category: slugOf(cells.category), dismissedOn: optionalDate(cells, 'dismissed_on'), id: ownIdOf('dismissed', row, shared) }
}
