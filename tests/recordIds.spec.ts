import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_WRITES } from '../src/apps/company/billingPlan/application/billingWrites'
import { DISMISSAL_WRITES } from '../src/apps/company/rules/application/dismissalWrites'
import { SPLIT_WRITES } from '../src/apps/company/transactions/application/splitWrites'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import type { WriteRules } from '../src/shared/storage/domain/writeRules'
import { readSnapshot, spreadsheetTabOfKind } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot, WorkbookTab } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { ASSET_WRITES, OWNER_ADVANCE_WRITES, PLAN_WRITES, YEAR_END_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { withIds } from './fixtures/rowIds'
import { forgetCaches, workbookGrids } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** One tab whose rows carry ids, two valid rows on it, the records the workbook reads from it and the labels of its two rows. */
interface IdTab {
  readonly rules: WriteRules<unknown>
  readonly grid: CellValue[][]
  readonly records: (workbook: HrDooWorkbook) => readonly unknown[]
  readonly first: string
  readonly second: string
}

const ID_TABS: readonly IdTab[] = [
  {
    rules: BILLING_WRITES as WriteRules<unknown>,
    grid: [
      ['item', 'date', 'amount', 'client', 'description'],
      ['Monthly Fee', 46326, 4000, 'acme', 'Oct 2026'],
      ['Bonus', 46300, 800, 'acme', ''],
    ],
    records: (workbook) => workbook.billingPlan,
    first: 'Monthly Fee, acme, 2026-10-31, 4000',
    second: 'Bonus, acme, 2026-10-05, 800',
  },
  {
    rules: OWNER_ADVANCE_WRITES as WriteRules<unknown>,
    grid: [
      ['date', 'amount', 'description', 'category'],
      [46200, 12.5, 'Stamps', 'printing'],
      [46210, 30, '', 'printing'],
    ],
    records: (workbook) => workbook.ownerAdvances,
    first: 'Stamps, 12.5, 2026-06-27',
    second: '30, 2026-07-07',
  },
  {
    rules: ASSET_WRITES as WriteRules<unknown>,
    grid: [
      ['asset', 'bought', 'cost_net', 'group'],
      ['Laptop', 45809, 1519.2, 'computers'],
      ['Desk', 45810, 300, 'equipment'],
    ],
    records: (workbook) => workbook.assets,
    first: 'Laptop',
    second: 'Desk',
  },
  {
    rules: YEAR_END_WRITES as WriteRules<unknown>,
    grid: [
      ['year', 'statement', 'line', 'label', 'amount', 'categories'],
      [2025, 'pl', 'sales', 'Sales', 46800],
      [2025, 'konto', '41850', 'Software', 435.87, 'ai-services'],
    ],
    records: (workbook) => workbook.yearEndLines,
    first: '2025 pl sales',
    second: '2025 konto 41850',
  },
  {
    rules: PLAN_WRITES as WriteRules<unknown>,
    grid: [
      ['year', 'month', 'item', 'amount', 'note'],
      [2027, '', 'printing', 10],
      [2027, 6, 'dividend', 8000],
    ],
    records: (workbook) => workbook.planLines,
    first: 'printing, 2027, 10',
    second: 'dividend, 2027, month 6, 8000',
  },
  {
    rules: SPLIT_WRITES as WriteRules<unknown>,
    grid: [
      ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note'],
      [46299, 'main', -20, 1038.9, -12, 'ai-services'],
      [46299, 'main', -20, 1038.9, -8, 'printing'],
    ],
    records: (workbook) => workbook.splits.flatMap((split) => split.parts),
    first: 'ai-services, -12, 2026-10-04',
    second: 'printing, -8, 2026-10-04',
  },
  {
    rules: DISMISSAL_WRITES as WriteRules<unknown>,
    grid: [
      ['kind', 'key', 'category', 'dismissed_on'],
      ['not-covered', 'name:desk co', 'equipment', 46316],
      ['exception', 'name:corner shop'],
    ],
    records: (workbook) => workbook.dismissals,
    first: 'name:desk co, 2026-10-21',
    second: 'name:corner shop',
  },
]

function tabOf(tab: IdTab): WorkbookTab {
  return spreadsheetTabOfKind(tab.rules.kind).tab
}

/** The write-back workbook with a printing category and a client, and this tab. */
function gridsWith(tab: IdTab, grid: CellValue[][]): Record<string, CellValue[][]> {
  const base = workbookGrids()
  return {
    ...base,
    categories: [...base.categories!, ['printing', 'operating', 'operating']],
    clients: [
      ['client', 'name', 'iban'],
      ['acme', 'Acme Studio', 'XX00FAKE0000000099'],
    ],
    [tabOf(tab)]: grid,
  }
}

function workbookOf(grids: Record<string, CellValue[][]>): HrDooWorkbook {
  const tabs = Object.fromEntries(Object.entries(grids).map(([tab, grid]) => [tab, sheetRowsFromValues(grid)]))
  const meta = { id: 'books', source: 'browser', title: 'Books', syncedAt: '2026-10-22T08:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs: [] }
  return hrDooWorkbook(readSnapshot({ meta, ...EMPTY_TABS, ...tabs } as WorkbookSnapshot).workbook)
}

function problemsOn(workbook: Workbook, tab: string): [string, string][] {
  return workbook.problems.filter((problem) => problem.tab === tab).map((problem) => [problem.label, problem.reason])
}

/** A row's cells without its id cell, as a row added by hand. */
function withoutId<Cell extends CellValue | null>(row: readonly Cell[], idColumn: number): (Cell | '')[] {
  return row.map((cell, column) => (column === idColumn ? '' : cell))
}

describe.each(ID_TABS.map((tab) => [tabOf(tab), tab] as const))('the %s tab', (name, tab) => {
  it('reads every row whose id no other row holds', () => {
    const workbook = workbookOf(gridsWith(tab, withIds('row', tab.grid)))

    expect(problemsOn(workbook, name)).toEqual([])
    expect(tab.records(workbook)).toHaveLength(2)
  })

  it('leaves out a row without an id, naming it by its label', () => {
    const grid = withIds('row', tab.grid)
    grid[1] = withoutId(grid[1]!, grid[0]!.indexOf('id'))
    const workbook = workbookOf(gridsWith(tab, grid))

    expect(problemsOn(workbook, name)[0]).toEqual([tab.first, 'no id, so it is left out. Give it an id in the workbook that no other row holds, or delete the row and add it in the app'])
    expect(tab.records(workbook).length).toBeLessThan(2)
  })

  it('leaves out every row of an id two rows hold, naming each by its label', () => {
    const grid = withIds('row', tab.grid)
    const idColumn = grid[0]!.indexOf('id')
    grid[2]![idColumn] = grid[1]![idColumn]!
    const workbook = workbookOf(gridsWith(tab, grid))

    const copied = 'the same id as another row, so it is left out. Give the copied row an id of its own in the workbook, or delete it and add it in the app'
    expect(problemsOn(workbook, name).slice(0, 2)).toEqual([
      [tab.first, copied],
      [tab.second, copied],
    ])
    expect(tab.records(workbook)).toEqual([])
  })
})
