import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_PLAN_ROWS } from '../src/features/billingPlan/application/billingPlanRows'
import { DISMISSED_ROWS } from '../src/features/review/application/dismissedRows'
import { ASSET_ROWS, YEAR_END_ROWS } from '../src/features/settings/application/workbookTabRows'
import { SPLIT_ROWS } from '../src/features/transactions/application/splitRows'
import { OWNER_ADVANCE_ROWS } from '../src/features/workbook/application/ownerAdvanceRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import type { TabRowRules } from '../src/features/workbook/application/tabRowWrites'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { PLAN_ROWS } from '../src/packs/hr-doo/application/planRows'
import { withIds } from './fixtures/rowIds'
import { forgetCaches, googleHarness, workbookGrids } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** One tab whose rows carry ids, two valid rows on it, the records the workbook reads from it and the labels of its two rows. */
interface IdTab {
  readonly rules: TabRowRules
  readonly grid: CellValue[][]
  readonly records: (workbook: Workbook) => readonly unknown[]
  readonly first: string
  readonly second: string
}

const ID_TABS: readonly IdTab[] = [
  {
    rules: BILLING_PLAN_ROWS,
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
    rules: OWNER_ADVANCE_ROWS,
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
    rules: ASSET_ROWS,
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
    rules: YEAR_END_ROWS,
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
    rules: PLAN_ROWS,
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
    rules: SPLIT_ROWS,
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
    rules: DISMISSED_ROWS,
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
    [tab.rules.tab]: grid,
  }
}

function workbookOf(grids: Record<string, CellValue[][]>): Workbook {
  const tabs = Object.fromEntries(Object.entries(grids).map(([tab, grid]) => [tab, sheetRowsFromValues(grid)]))
  const meta = { id: 'books', source: 'excel', title: 'Books', syncedAt: '2026-10-22T08:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs: [] }
  return readWorkbook({ meta, ...EMPTY_TABS, ...tabs } as WorkbookSnapshot)
}

function problemsOn(workbook: Workbook, tab: string): [string, string][] {
  return workbook.problems.filter((problem) => problem.tab === tab).map((problem) => [problem.label, problem.reason])
}

/** A row's cells without its id cell, as a row added by hand. */
function withoutId<Cell extends CellValue | null>(row: readonly Cell[], idColumn: number): (Cell | '')[] {
  return row.map((cell, column) => (column === idColumn ? '' : cell))
}

describe.each(ID_TABS.map((tab) => [tab.rules.tab, tab] as const))('the %s tab', (name, tab) => {
  it('reads every row whose id no other row holds', () => {
    const workbook = workbookOf(gridsWith(tab, withIds('row', tab.grid)))

    expect(problemsOn(workbook, name)).toEqual([])
    expect(tab.records(workbook)).toHaveLength(2)
  })

  it('leaves out a row without an id, naming it by its label', () => {
    const grid = withIds('row', tab.grid)
    grid[1] = withoutId(grid[1]!, grid[0]!.indexOf('id'))
    const workbook = workbookOf(gridsWith(tab, grid))

    expect(problemsOn(workbook, name)[0]).toEqual([tab.first, 'no id, so it is left out until "Add ids" on Overview gives it one'])
    expect(tab.records(workbook).length).toBeLessThan(2)
  })

  it('leaves out every row of an id two rows hold, naming each by its label', () => {
    const grid = withIds('row', tab.grid)
    const idColumn = grid[0]!.indexOf('id')
    grid[2]![idColumn] = grid[1]![idColumn]!
    const workbook = workbookOf(gridsWith(tab, grid))

    const copied = 'the same id as another row, so it is left out. Clear the id cell of the copied row, and "Add ids" on Overview gives it its own'
    expect(problemsOn(workbook, name).slice(0, 2)).toEqual([
      [tab.first, copied],
      [tab.second, copied],
    ])
    expect(tab.records(workbook)).toEqual([])
  })
})

describe.each(ID_TABS.map((tab) => [tab.rules.tab, tab] as const))('a write to the %s tab of a Google Sheet', (name, tab) => {
  function targets(store: WorkbookStore) {
    return store.state.snapshot![tab.rules.tab].map((row) => rowCellsOf(row, tab.rules))
  }

  it('finds its rows by their ids after rows were inserted above them from outside', async () => {
    const { store, sheets } = await googleHarness(used, gridsWith(tab, withIds('row', tab.grid)))
    const grid = sheets.grids[name]!
    const inserted = withoutId(grid[2]!, grid[0]!.indexOf('id'))
    grid.splice(1, 0, inserted, [...inserted])

    await store.changeRows(tab.rules, { added: [], changed: [], removed: targets(store) })

    expect(sheets.grids[name]!.slice(1)).toEqual([inserted, inserted])
    expect(tab.records(store.state.workbook!)).toEqual([])
  })

  it('refuses a row without an id, an id two rows hold, and a row changed since the app read it', async () => {
    const { store, sheets } = await googleHarness(used, gridsWith(tab, withIds('row', tab.grid)))
    const [first] = targets(store)
    const grid = sheets.grids[name]!
    const label = `the ${tab.rules.kind.noun.one} "${tab.first}"`
    const remove = (cells: NonNullable<typeof first>) => store.changeRows(tab.rules, { added: [], changed: [], removed: [cells] })

    await expect(remove({ ...first!, id: '' })).rejects.toThrow(`has no id yet, so the app cannot find it. Press "Add ids" on Overview, then try again.`)

    grid.push([...grid[1]!])
    await expect(remove(first!)).rejects.toThrow(`2 rows of the ${name} tab hold the id of ${label}, so the app cannot tell which one is meant. Clear the id cell of the copied row in the Sheet.`)

    grid.pop()
    grid[1]![grid[0]!.indexOf(tab.rules.columns[0]!)] = 'changed in the Sheet'
    await expect(remove(first!)).rejects.toThrow(`is no longer on the ${name} tab as the app read it. Sync and look again.`)
    expect(grid).toHaveLength(3)
  })
})
