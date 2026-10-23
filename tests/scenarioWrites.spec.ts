import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookCopy } from '../src/features/workbook/application/workbookPorts'
import { recordsOfKindIn } from '../src/features/workbook/domain/readWorkbook'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { copyScenario, renameScenario, scenarioRowsOf } from '../src/packs/hr-doo/application/scenarioWrites'
import { SCENARIO_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'
import { SCENARIO_WRITES } from '../src/packs/hr-doo/domain/hrDooWrites'
import { scenarioRowOfComponent } from '../src/packs/hr-doo/domain/scenarios/scenariosReading'
import type { ScenarioRow } from '../src/packs/hr-doo/domain/scenarios/scenariosReading'
import { cellsOf } from './fixtures/recordWrites'
import { startingScenarios } from '../src/packs/hr-doo/domain/scenarios/startingScenarios'
import { civil, euros } from './fixtures/ledger'
import { STEADY_GRANT } from './fixtures/steadyStudio'
import { excelHarness, forgetCaches, googleHarness, sentRequests, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'

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

function rowsOf(store: WorkbookStore<WorkbookCopy>, slug: string): ScenarioRow[] {
  return recordsOfKindIn(store.state.records!, SCENARIO_RECORDS)
    .records.map((read) => read.record)
    .filter((row) => row.slug === slug)
}

function writeScenarios(store: WorkbookStore<WorkbookCopy>, work: (rows: Parameters<typeof copyScenario>[0]) => void, addMissingKinds = false) {
  return store.write('Scenarios saved', (unit) => work(unit.of(SCENARIO_WRITES)), { addMissingKinds })
}

function scenarios(store: WorkbookStore<WorkbookCopy>): [string, string, string[]][] {
  return (hrDooWorkbook(store.state.workbook!).payScenarios ?? []).map((scenario) => [scenario.slug, scenario.label, scenario.components.map((component) => component.component)])
}

describe('starting scenarios on a Google Sheet without a scenarios tab', () => {
  const drafts = startingScenarios(2027, [STEADY_GRANT], euros(250)).drafts

  it('refuses until the person agrees to add the tab', async () => {
    const { store, sheets } = await googleHarness(used)
    await expect(writeScenarios(store, (rows) => scenarioRowsOf(drafts).forEach((row) => rows.add(row)))).rejects.toThrow(
      new WorkbookWriteRefused('The workbook has no scenarios tab, so nothing was written.'),
    )
    expect(sheets.requests.filter((request) => request.kind !== 'sheetGrids' && request.kind !== 'batchGet')).toEqual([])
  })

  it('adds the tab with the template header and the rows in one request, and reads them back', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)
    const receipt = await writeScenarios(store, (rows) => scenarioRowsOf(drafts).forEach((row) => rows.add(row)), true)

    expect(sheets.requests.map((request) => request.kind)).toEqual(['sheetGrids', 'batchGet', 'updateSpreadsheet', 'sheetGrids', 'batchGet'])
    expect(sentRequests(sheets).map((request) => Object.keys(request)[0]).slice(0, 3)).toEqual(['addSheet', 'updateCells', 'appendCells'])
    expect(sentRequests(sheets).slice(3).every((request) => 'repeatCell' in request)).toBe(true)
    expect(writtenRanges()).toEqual(['scenarios!A1:G1'])
    expect(sheets.grids.scenarios?.[0]).toEqual(HEADER)
    expect(sheets.grids.scenarios?.[3]).toEqual(['floor-salary-extras-2027', 'Floor salary, tax-free items and rent', 2027, 'salary_gross', 'floor', null, null])
    expect(sheets.grids.scenarios?.[9]).toEqual(['floor-then-board-2027', 'Floor salary, then board member only', 2027, 'salary_gross', 'floor', null, MAY_LAST])
    expect(sheets.grids.scenarios?.[10]).toEqual(['floor-then-board-2027', null, 2027, 'director_basis', 'board-only', JUNE_FIRST, null])
    expect(sheets.formats.scenarios?.[9]?.[6]).toBe('yyyy-mm-dd')
    expect(sheets.formats.scenarios?.[10]?.[5]).toBe('yyyy-mm-dd')
    expect(sheets.formats.scenarios?.[10]?.[4]).toBeUndefined()
    expect(cellsOf(receipt, 'add')).toHaveLength(14)
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
    await writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'rent_monthly', amount: euros(250), from: civil('2027-07-01'), to: null })))
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend', 'rent_monthly']]])

    const [salary] = rowsOf(store, 'floor')
    await writeScenarios(store, (rows) => rows.change(salary!, scenarioRowOfComponent(salary!.slug, salary!.label, salary!.year, { component: 'salary_gross', gross: euros(1800), from: null, to: null })))
    expect(hrDooWorkbook(store.state.workbook!).payScenarios[0]?.components[0]).toMatchObject({ component: 'salary_gross', gross: euros(1800) })

    const rent = rowsOf(store, 'floor').find((row) => row.component.component === 'rent_monthly')!
    await writeScenarios(store, (rows) => rows.remove(rent))
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend']]])

    await store.undo(store.state.writes[0]!)
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend', 'rent_monthly']]])
  })

  it('copies a scenario under a new name', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await writeScenarios(store, (rows) => copyScenario(rows, rowsOf(store, 'floor'), 'floor-copy', 'Floor salary, copy'))
    expect(scenarios(store)).toEqual([
      ['floor', 'Floor salary', ['salary_gross', 'dividend']],
      ['floor-copy', 'Floor salary, copy', ['salary_gross', 'dividend']],
    ])
  })

  it('renames a scenario no plan row names', async () => {
    const grids = { ...gridsWithScenarios(), plan: [['year', 'month', 'item', 'amount', 'note']] }
    const { store } = await harnessOf(used, grids)
    await writeScenarios(store, (rows) => renameScenario(rows, rowsOf(store, 'floor'), 'floor-all-year', 'At the floor all year'))
    expect(scenarios(store)).toEqual([['floor-all-year', 'At the floor all year', ['salary_gross', 'dividend']]])
  })

  it('clears the label of every row when a rename leaves it blank', async () => {
    const grids = { ...gridsWithScenarios(), scenarios: [HEADER, ['floor', '', 2027, 'salary_gross', 'floor'], ['floor', 'Floor salary', 2027, 'dividend', 'max']], plan: [['year', 'month', 'item', 'amount', 'note']] }
    const { store } = await harnessOf(used, grids)
    await writeScenarios(store, (rows) => renameScenario(rows, rowsOf(store, 'floor'), 'floor-all-year', ''))
    expect(scenarios(store)).toEqual([['floor-all-year', '', ['salary_gross', 'dividend']]])
  })

  it('refuses a rename the plan tab or another scenario stands in the way of', async () => {
    const { store } = await harnessOf(used, {
      ...gridsWithScenarios(),
      scenarios: [...gridsWithScenarios().scenarios!, ['other', '', 2027, 'salary_gross', 'floor']],
    })
    await expect(writeScenarios(store, (rows) => renameScenario(rows, rowsOf(store, 'floor'), 'floor-all-year', ''))).rejects.toThrow(
      'Nothing was written. "floor" cannot be renamed, since it is used by 1 plan tab row.',
    )
    await expect(writeScenarios(store, (rows) => renameScenario(rows, rowsOf(store, 'other'), 'floor', ''))).rejects.toThrow('"floor" is already a scenario. Pick another name.')
    await expect(writeScenarios(store, (rows) => renameScenario(rows, rowsOf(store, 'other'), 'Other Mix', ''))).rejects.toThrow('is not a scenario name the app can use')
  })

  it('refuses a component a scenario guard or the reader stops', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await expect(writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'dividend', amount: euros(1000), from: civil('2027-07-01'), to: null })))).rejects.toThrow(
      "Nothing was written. Floor salary: The scenario sets 2 dividends. A scenario pays one, out of the year's profit.",
    )
    await expect(writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'rent_monthly', amount: euros(-5), from: null, to: null })))).rejects.toThrow(
      'The new scenario row "floor, rent_monthly" would be left out: amount "-5" is not an amount above zero.',
    )
  })
})
