import { civilDateFromSerial, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { cellText } from '../../../shared/text/cellText'
import type { RowCells } from '../domain/rowChanges'
import { definedCategories, readOwnerAdvanceRows } from '../infrastructure/workbookReader'
import { TEMPLATE_COLUMNS } from '../infrastructure/workbookTemplate'
import type { TabRowRules } from './tabRowWrites'

/** A cost the owner paid privately, as the Add advance form gives it. */
export interface OwnerAdvanceDraft {
  readonly date: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly description: string
  readonly category: string
}

/** An advance as the tab holds it: the date as a serial number, so the cell is a date cell like one typed in the Sheet. */
export function ownerAdvanceCellsOf(draft: OwnerAdvanceDraft): RowCells {
  return { date: serialFromCivilDate(draft.date), amount: amountOf(draft.amount), description: draft.description.trim(), category: draft.category.trim().toLowerCase() }
}

const COLUMNS = TEMPLATE_COLUMNS['owner-advances'].map((column) => column.name)

/** The `owner-advances` tab, checked by its reader against the categories tab as it is now: an amount above zero, in an operating or taxes category. */
export const OWNER_ADVANCE_ROWS: TabRowRules = {
  tab: 'owner-advances',
  noun: { one: 'owner advance', many: 'owner advances', article: 'an' },
  columns: COLUMNS,
  required: COLUMNS,
  caseless: ['category'],
  dates: ['date'],
  reads: ['categories'],
  read: (rows, fresh) => readOwnerAdvanceRows(rows, definedCategories(fresh.categories?.rows ?? [])),
  refusals: () => [],
  label: (cells) => {
    const date = typeof cells.date === 'number' && Number.isFinite(cells.date) ? civilDateFromSerial(cells.date) : cellText(cells.date)
    return [cellText(cells.description), date].filter((part) => part !== '').join(', ') || 'blank'
  },
}
