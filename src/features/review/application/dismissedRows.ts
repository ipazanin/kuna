import { civilDateFromSerial, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import type { CoverageGroup } from '../../rules/domain/ruleCoverage'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import type { SuggestionKind } from '../../workbook/domain/dismissals'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { readDismissals } from '../../workbook/infrastructure/dismissedTabReader'
import { contentColumns } from '../../workbook/infrastructure/workbookTemplate'

const COLUMNS = contentColumns('dismissed')

/** The `dismissed` tab, checked by its own reader. Nothing else reads it, so nothing else can refuse it. */
export const DISMISSED_ROWS: TabRowRules = {
  tab: 'dismissed',
  noun: { one: 'dismissed suggestion', many: 'dismissed suggestions', article: 'a' },
  columns: COLUMNS,
  required: ['kind', 'key'],
  caseless: ['kind', 'category'],
  reads: [],
  read: (rows) => readDismissals(rows),
  refusals: () => [],
  label: (cells) => {
    const day = typeof cells.dismissed_on === 'number' && Number.isFinite(cells.dismissed_on) ? `, ${civilDateFromSerial(cells.dismissed_on)}` : ''
    return `${cellText(cells.key) || 'blank'}${day}`
  },
}

/** The row that dismisses a group: its kind, its key, the category most of its rows are in, and the day, as a date cell. */
export function dismissalCells(kind: SuggestionKind, group: CoverageGroup<unknown>, on: CivilDate): RowCells {
  return { kind, key: group.key, category: group.categories[0]?.category ?? '', dismissed_on: serialFromCivilDate(on) }
}
