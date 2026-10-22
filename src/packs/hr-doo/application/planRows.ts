import type { RowsChangeCheck, TabRowRules } from '../../../features/workbook/application/tabRowWrites'
import type { FreshTabs } from '../../../features/workbook/application/workbookWriter'
import type { AssetGroup } from '../../../features/workbook/domain/assets'
import type { RowAt, RowCells, TabRowsChange } from '../../../features/workbook/domain/rowChanges'
import { wholeNumberOf } from '../../../features/workbook/infrastructure/cellReading'
import { readPlan } from '../../../features/workbook/infrastructure/planTabReader'
import { readScenarios } from '../../../features/workbook/infrastructure/scenariosTabReader'
import { definedCategorySlugs } from '../../../features/workbook/infrastructure/workbookReader'
import type { SheetRow } from '../../../features/workbook/infrastructure/workbookSnapshot'
import { contentColumns } from '../../../features/workbook/infrastructure/workbookTemplate'
import { serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { cellText } from '../../../shared/text/cellText'
import { planGuards } from '../domain/forecast/planGuards'

const COLUMNS = contentColumns('plan')

/** A row of the plan tab as the tab holds it, every column given so a row is found again by all of them. */
function cells(year: number, month: number | null, item: string, amount: number | string, note: string, date: CivilDate | null = null, group = ''): RowCells {
  return { year, month: month ?? '', item, amount, note: note.trim(), date: date === null ? '' : serialFromCivilDate(date), group }
}

/** A category's plan for one month, or for every month with a null month. The amount is positive for income and costs alike. */
export function categoryPlanCells(year: number, month: number | null, category: string, amount: Money, note = ''): RowCells {
  return cells(year, month, category, amountOf(amount), note)
}

export function dividendPlanCells(year: number, month: number, amount: Money, note = ''): RowCells {
  return cells(year, month, 'dividend', amountOf(amount), note)
}

/** A purchase on the day it is bought and put in use, at its cost without the VAT reclaimed. */
export function purchasePlanCells(year: number, date: CivilDate, amount: Money, group: AssetGroup, note: string): RowCells {
  return cells(year, null, 'purchase', amountOf(amount), note, date, group)
}

/** The scenario the year's owner pay follows, from 1 January or from the day it takes over. */
export function ownerPayPlanCells(year: number, scenario: string, from: CivilDate | null): RowCells {
  return cells(year, null, 'owner_pay_scenario', scenario, '', from)
}

/** A plan row as the tab holds it, under the key it is matched by, such as its month. */
export interface KeyedRow<Cells> {
  readonly key: string
  readonly cells: Cells
}

/**
 * The write that turns the rows a part of the plan holds into the rows wanted: a key on both sides
 * changes its row only where the cells differ, a key only on the tab is deleted and a key only
 * wanted is added. Nothing changes when they already agree.
 */
export function replacedPlanRows(held: readonly KeyedRow<RowAt>[], wanted: readonly KeyedRow<RowCells>[]): TabRowsChange {
  const same = (first: RowCells, second: RowCells) => COLUMNS.every((column) => cellText(first[column]) === cellText(second[column]))
  return {
    added: wanted.filter((row) => !held.some((entry) => entry.key === row.key)).map((row) => row.cells),
    changed: held.flatMap((entry) => {
      const after = wanted.find((row) => row.key === entry.key)?.cells
      return after === undefined || same(entry.cells.cells, after) ? [] : [{ sheetRow: entry.cells.sheetRow, before: entry.cells.cells, after }]
    }),
    removed: held.filter((entry) => !wanted.some((row) => row.key === entry.key)).map((entry) => entry.cells),
  }
}

function readFresh(rows: readonly SheetRow[], fresh: FreshTabs) {
  return readPlan(rows, definedCategorySlugs(fresh.categories?.rows ?? []), new Set(readScenarios(fresh.scenarios?.rows ?? []).scenarios.map((scenario) => scenario.slug)))
}

/** After the reader has checked each row, the plan guards check every year the change touches. */
function planRefusals(check: RowsChangeCheck, fresh: FreshTabs): string[] {
  const years = new Set(
    check.edits.flatMap((edit) => [edit.before, edit.after].flatMap((touched) => (touched === null ? [] : [wholeNumberOf(touched.year)]))).filter((year): year is number => year !== null),
  )
  const lines = readFresh(check.after, fresh).facts.filter((line) => years.has(line.year))
  return planGuards(lines, readScenarios(fresh.scenarios?.rows ?? []).scenarios).map((guard) => guard.reason)
}

/** The `plan` tab: the reader checks each row against the categories and scenarios, then the plan guards check each year the change touches. */
export const PLAN_ROWS: TabRowRules = {
  tab: 'plan',
  noun: { one: 'plan row', many: 'plan rows', article: 'a' },
  columns: COLUMNS,
  required: ['year', 'month', 'item', 'amount'],
  caseless: ['item', 'amount', 'group'],
  reads: ['categories', 'scenarios'],
  read: readFresh,
  refusals: planRefusals,
  label: (row) => [cellText(row.item), cellText(row.year), cellText(row.month) === '' ? '' : `month ${cellText(row.month)}`].filter((part) => part !== '').join(', ') || 'blank',
}
