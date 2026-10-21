import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { RowAt } from '../src/features/workbook/domain/rowChanges'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { SCENARIO_ROWS, componentCells, copiedScenario, renamedScenario, scenarioCells } from '../src/packs/hr-doo/application/scenarioRows'
import { startingScenarios } from '../src/packs/hr-doo/domain/scenarios/startingScenarios'
import { civil, euros } from './fixtures/ledger'
import { STEADY_GRANT } from './fixtures/steadyStudio'
import { excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const HEADER = ['scenario', 'label', 'year', 'component', 'amount', 'from', 'to']
// 2027-06-01 and 2027-05-31 as serial days.
const JUNE_FIRST = 46539
const MAY_LAST = 46538

function gridsWithScenarios(): Record<string, CellValue[][]> {
  return {
    ...workbookGrids(),
    scenarios: [HEADER, ['floor', 'Floor salary', 2027, 'salary_gross', 'floor'], ['floor', '', 2027, 'dividend', 'max']],
    plan: [
      ['year', 'month', 'item', 'amount', 'note'],
      [2027, '', 'owner_pay_scenario', 'floor', ''],
    ],
  }
}

function rowsOf(store: WorkbookStore, slug: string): RowAt[] {
  return (store.state.snapshot?.scenarios ?? []).filter((row) => row.cells.scenario === slug).map((row) => ({ sheetRow: row.sheetRow, cells: rowCellsOf(row, SCENARIO_ROWS.columns) }))
}

function scenarios(store: WorkbookStore): [string, string, string[]][] {
  return (store.state.workbook?.payScenarios ?? []).map((scenario) => [scenario.slug, scenario.label, scenario.components.map((component) => component.component)])
}

describe('starting scenarios on a Google Sheet without a scenarios tab', () => {
  const drafts = startingScenarios(2027, [STEADY_GRANT], euros(250)).drafts

  it('refuses until the person agrees to add the tab', async () => {
    const { store, sheets } = await googleHarness(used)
    await expect(store.changeRows(SCENARIO_ROWS, { added: scenarioCells(drafts), changed: [], removed: [] })).rejects.toThrow(
      new WorkbookWriteRefused('The workbook has no scenarios tab, so nothing was written.'),
    )
    expect(sheets.requests.filter((request) => request.kind !== 'sheetIds' && request.kind !== 'batchGet')).toEqual([])
  })

  it('adds the tab with the template header and the rows in one request, and reads them back', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)
    const receipt = await store.changeRows(SCENARIO_ROWS, { added: scenarioCells(drafts), changed: [], removed: [] }, true)

    expect(sheets.requests.map((request) => request.kind)).toEqual(['sheetIds', 'batchGet', 'updateSpreadsheet', 'sheetIds', 'batchGet'])
    expect(sentRequests(sheets).map((request) => Object.keys(request)[0])).toEqual(['addSheet', 'updateCells', 'appendCells'])
    expect(writtenRanges()).toEqual(['scenarios!A1:G1'])
    expect(sheets.grids.scenarios?.[0]).toEqual(HEADER)
    expect(sheets.grids.scenarios?.[3]).toEqual(['floor-salary-extras-2027', 'Floor salary, tax-free items and rent', 2027, 'salary_gross', 'floor', null, null])
    expect(sheets.grids.scenarios?.[9]).toEqual(['floor-then-board-2027', 'Floor salary, then board member only', 2027, 'salary_gross', 'floor', null, MAY_LAST])
    expect(sheets.grids.scenarios?.[10]).toEqual(['floor-then-board-2027', null, 2027, 'director_basis', 'board-only', JUNE_FIRST, null])
    expect(receipt?.added).toHaveLength(14)
    expect(store.state.snapshot?.meta.missingTabs).not.toContain('scenarios')
    expect(scenarios(store).map(([slug]) => slug)).toEqual(['floor-salary-2027', 'floor-salary-extras-2027', 'floor-then-board-2027', 'floor-then-elsewhere-2027'])
    expect(store.state.workbook?.problems.filter((problem) => problem.tab === 'scenarios')).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(scenarios(store)).toEqual([])
    expect(sheets.grids.scenarios?.[0]).toEqual(HEADER)
  })
})

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('scenario writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds, edits and deletes a component', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await store.changeRows(SCENARIO_ROWS, { added: [componentCells('floor', 2027, { component: 'rent_monthly', amount: euros(250), from: civil('2027-07-01'), to: null })], changed: [], removed: [] })
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend', 'rent_monthly']]])

    const [salary] = rowsOf(store, 'floor')
    await store.changeRows(SCENARIO_ROWS, { added: [], changed: [{ sheetRow: salary!.sheetRow, before: salary!.cells, after: { ...salary!.cells, amount: 1800 } }], removed: [] })
    expect(store.state.workbook?.payScenarios[0]?.components[0]).toMatchObject({ component: 'salary_gross', gross: euros(1800) })

    const rent = rowsOf(store, 'floor').find((row) => row.cells.component === 'rent_monthly')!
    await store.changeRows(SCENARIO_ROWS, { added: [], changed: [], removed: [rent] })
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend']]])

    await store.undo(store.state.writes[0]!)
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend', 'rent_monthly']]])
  })

  it('copies a scenario under a new name', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await store.changeRows(SCENARIO_ROWS, copiedScenario(rowsOf(store, 'floor'), 'floor-copy', 'Floor salary, copy'))
    expect(scenarios(store)).toEqual([
      ['floor', 'Floor salary', ['salary_gross', 'dividend']],
      ['floor-copy', 'Floor salary, copy', ['salary_gross', 'dividend']],
    ])
  })

  it('renames a scenario no plan row names', async () => {
    const grids = { ...gridsWithScenarios(), plan: [['year', 'month', 'item', 'amount', 'note']] }
    const { store } = await harnessOf(used, grids)
    await store.changeRows(SCENARIO_ROWS, renamedScenario(rowsOf(store, 'floor'), 'floor-all-year', 'At the floor all year'))
    expect(scenarios(store)).toEqual([['floor-all-year', 'At the floor all year', ['salary_gross', 'dividend']]])
  })

  it('clears the label of every row when a rename leaves it blank', async () => {
    const grids = { ...gridsWithScenarios(), scenarios: [HEADER, ['floor', '', 2027, 'salary_gross', 'floor'], ['floor', 'Floor salary', 2027, 'dividend', 'max']], plan: [['year', 'month', 'item', 'amount', 'note']] }
    const { store } = await harnessOf(used, grids)
    await store.changeRows(SCENARIO_ROWS, renamedScenario(rowsOf(store, 'floor'), 'floor-all-year', ''))
    expect(scenarios(store)).toEqual([['floor-all-year', '', ['salary_gross', 'dividend']]])
  })

  it('refuses a rename the plan tab or another scenario stands in the way of', async () => {
    const { store } = await harnessOf(used, {
      ...gridsWithScenarios(),
      scenarios: [...gridsWithScenarios().scenarios!, ['other', '', 2027, 'salary_gross', 'floor']],
    })
    await expect(store.changeRows(SCENARIO_ROWS, renamedScenario(rowsOf(store, 'floor'), 'floor-all-year', ''))).rejects.toThrow(
      'Nothing was written. "floor" cannot be renamed, since it is used by 1 plan tab row.',
    )
    await expect(store.changeRows(SCENARIO_ROWS, renamedScenario(rowsOf(store, 'other'), 'floor', ''))).rejects.toThrow('"floor" is already a scenario, on row 2. Pick another name.')
    await expect(store.changeRows(SCENARIO_ROWS, renamedScenario(rowsOf(store, 'other'), 'Other Mix', ''))).rejects.toThrow('is not a scenario name the app can use')
  })

  it('refuses a component a scenario guard or the reader stops', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await expect(store.changeRows(SCENARIO_ROWS, { added: [componentCells('floor', 2027, { component: 'dividend', amount: euros(1000), from: civil('2027-07-01'), to: null })], changed: [], removed: [] })).rejects.toThrow(
      "Nothing was written. Floor salary: Rows 3 and 4 each set a dividend. A scenario pays one, out of the year's profit.",
    )
    await expect(store.changeRows(SCENARIO_ROWS, { added: [{ ...componentCells('floor', 2027, { component: 'rent_monthly', amount: euros(250), from: null, to: null }), amount: -5 }], changed: [], removed: [] })).rejects.toThrow(
      'The new scenario row would be left out: amount "-5" is not an amount above zero.',
    )
  })
})
