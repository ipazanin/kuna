import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { copyScenario, renameScenario } from '../src/apps/company/packs/hr-doo/application/scenarioWrites'
import { SCENARIO_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { SCENARIO_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { scenarioRowOfComponent } from '../src/apps/company/packs/hr-doo/domain/scenarios/scenariosReading'
import type { ScenarioRow } from '../src/apps/company/packs/hr-doo/domain/scenarios/scenariosReading'
import { civil, euros } from './fixtures/ledger'
import { browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const HEADER = ['scenario', 'label', 'year', 'component', 'amount', 'from', 'to']

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

function rowsOf(store: WorkbookStore<CompanyBooks>, slug: string): ScenarioRow[] {
  return recordsOfKindIn(store.state.records!, SCENARIO_RECORDS)
    .records.map((read) => read.record)
    .filter((row) => row.slug === slug)
}

function writeScenarios(store: WorkbookStore<CompanyBooks>, work: (rows: Parameters<typeof copyScenario>[0]) => void) {
  return store.write('Scenarios saved', (unit) => work(unit.of(SCENARIO_WRITES)))
}

function scenarios(store: WorkbookStore<CompanyBooks>): [string, string, string[]][] {
  return (hrDooWorkbook(store.state.workbook!).payScenarios ?? []).map((scenario) => [scenario.slug, scenario.label, scenario.components.map((component) => component.component)])
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('scenario writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds, edits and deletes a component', async () => {
    const { store } = await harnessOf(used, gridsWithScenarios())
    await writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'rent_monthly', amount: euros(250), from: civil('2027-07-01'), to: null })))
    expect(scenarios(store)).toEqual([['floor', 'Floor salary', ['salary_gross', 'dividend', 'rent_monthly']]])

    const [salary] = rowsOf(store, 'floor')
    await writeScenarios(store, (rows) =>
      rows.change(salary!, scenarioRowOfComponent(salary!.slug, salary!.label, salary!.year, { component: 'salary_gross', gross: euros(1800), from: null, to: null })),
    )
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
    const grids = {
      ...gridsWithScenarios(),
      scenarios: [HEADER, ['floor', '', 2027, 'salary_gross', 'floor'], ['floor', 'Floor salary', 2027, 'dividend', 'max']],
      plan: [['year', 'month', 'item', 'amount', 'note']],
    }
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
    await expect(
      writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'dividend', amount: euros(1000), from: civil('2027-07-01'), to: null }))),
    ).rejects.toThrow("Nothing was written. Floor salary: The scenario sets 2 dividends. A scenario pays one, out of the year's profit.")
    await expect(writeScenarios(store, (rows) => rows.add(scenarioRowOfComponent('floor', '', 2027, { component: 'rent_monthly', amount: euros(-5), from: null, to: null })))).rejects.toThrow(
      'The new scenario row "floor, rent_monthly" would be left out: amount "-5.00" is not an amount above zero.',
    )
  })
})
