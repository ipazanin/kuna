import { SUGGESTION_KINDS } from '../domain/dismissals'
import type { Dismissal } from '../domain/dismissals'
import { sharedKeys } from '../domain/sharedKeys'
import { idOf, inTabOrder, isUnreadable, optionalDate, readRow, refuse, requiredChoice, slugOf, textOf } from './cellReading'
import type { RowProblem, TabReading } from './cellReading'
import type { SheetRow } from './workbookSnapshot'

/** The `dismissed` tab. A suggestion dismissed on more than one row is left out on every one, so it shows again until one row is cleared. */
export function readDismissals(rows: readonly SheetRow[]): TabReading<Dismissal> {
  const read: Dismissal[] = []
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const dismissal = readRow(() => readDismissalRow(row))
    if (isUnreadable(dismissal)) {
      problems.push({ sheetRow: row.sheetRow, reason: dismissal.unreadable })
    } else {
      read.push(dismissal)
    }
  }
  const keyOf = (dismissal: Dismissal): string => `${dismissal.kind} ${dismissal.key}`
  const shared = sharedKeys(read, keyOf)
  for (const dismissal of read.filter((candidate) => shared.has(keyOf(candidate)))) {
    problems.push({ sheetRow: dismissal.sheetRow, reason: `${dismissal.key} is dismissed on more than one row, so none of them counts` })
  }
  return { facts: read.filter((dismissal) => !shared.has(keyOf(dismissal))), problems }
}

function readDismissalRow(row: SheetRow): Dismissal {
  const { cells } = row
  const kind = requiredChoice(cells, 'kind', SUGGESTION_KINDS, 'kind of suggestion')
  const key = textOf(cells.key)
  if (key === '') refuse('no key')
  return { kind, key, category: slugOf(cells.category), dismissedOn: optionalDate(cells, 'dismissed_on'), sheetRow: row.sheetRow, ...idOf(cells) }
}
