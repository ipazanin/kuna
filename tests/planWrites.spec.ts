import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { categoryPlanLine, dividendPlanLine, ownerPayPlanLine, purchasePlanLine, replacePlanLines } from '../src/apps/company/packs/hr-doo/application/planWrites'
import type { KeyedLine, PlanLineDraft } from '../src/apps/company/packs/hr-doo/application/planWrites'
import type { PlanLine } from '../src/apps/company/packs/hr-doo/domain/forecast/plan'
import { PLAN_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { PLAN_WRITES, SCENARIO_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { scenarioRowOfComponent } from '../src/apps/company/packs/hr-doo/domain/scenarios/scenariosReading'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import { civil, euros } from './fixtures/ledger'
import { cellsOf } from './fixtures/recordWrites'
import { withIds } from './fixtures/rowIds'
import { browserHarness, forgetCaches, driveHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const PLAN_HEADER = ['year', 'month', 'item', 'amount', 'note', 'date', 'group']

function grids(plan: CellValue[][] = [PLAN_HEADER]): Record<string, CellValue[][]> {
  return {
    ...workbookGrids(),
    scenarios: [
      ['scenario', 'label', 'year', 'component', 'amount', 'from', 'to'],
      ['floor', 'Floor salary', 2027, 'salary_gross', 'floor'],
      ['board', 'Board only', 2027, 'director_basis', 'board-only'],
      ['old', '', 2026, 'salary_gross', 'floor'],
    ],
    plan: withIds('plan', plan),
  }
}

/** The plan lines as stored, in the order of the tab. */
function stored(store: WorkbookStore<CompanyBooks>): PlanLine[] {
  return recordsOfKindIn(store.state.records!, PLAN_RECORDS).records.map((read) => read.record)
}

/** Writes the plan as the plan dialogs do. */
function writePlan(store: WorkbookStore<CompanyBooks>, held: readonly KeyedLine<PlanLine>[], wanted: readonly KeyedLine<PlanLineDraft>[]) {
  return store.write('Plan saved', (unit) => replacePlanLines(unit.of(PLAN_WRITES), held, wanted))
}

/** Adds the lines, each under a key of its own. */
function addLines(store: WorkbookStore<CompanyBooks>, drafts: readonly PlanLineDraft[]) {
  return writePlan(store, [], drafts.map((line, index) => ({ key: String(index), line })))
}

function lines(store: WorkbookStore<CompanyBooks>): string[] {
  return (hrDooWorkbook(store.state.workbook!).planLines ?? []).map((line) =>
    line.kind === 'owner-pay-scenario' ? `owner pay ${line.scenario} from ${line.from ?? 'January'}` : line.kind === 'purchase' ? `purchase ${line.note} on ${line.date}` : `${line.item} ${line.month ?? 'every'} ${line.amount}`,
  )
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('plan writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('plans a category for every month and a month of its own, changes it and clears it', async () => {
    const { store } = await harnessOf(used, grids())
    await writePlan(store, [], [
      { key: 'every', line: categoryPlanLine(2027, null, 'ai-services', euros(150)) },
      { key: '1', line: categoryPlanLine(2027, 1, 'ai-services', euros(900), 'Yearly seats') },
    ])
    expect(lines(store)).toEqual(['ai-services every 15000', 'ai-services 1 90000'])

    const held = stored(store).map((line) => ({ key: line.month === null ? 'every' : String(line.month), line }))
    const receipt = await writePlan(store, held, [{ key: 'every', line: categoryPlanLine(2027, null, 'ai-services', euros(175)) }])
    // The every-month row changes its amount only, and January's row goes.
    expect(cellsOf(receipt, 'change').map((cells) => cells.amount)).toEqual([175])
    expect(cellsOf(receipt, 'remove').map((cells) => cells.month)).toEqual([1])
    expect(lines(store)).toEqual(['ai-services every 17500'])

    await store.undo(store.state.writes[0]!)
    expect(lines(store)).toEqual(['ai-services every 15000', 'ai-services 1 90000'])
  })

  it('writes the owner pay with a switch day, a purchase and a dividend', async () => {
    const { store } = await harnessOf(used, grids())
    await addLines(store, [
      ownerPayPlanLine(2027, 'floor', null),
      ownerPayPlanLine(2027, 'board', civil('2027-06-05')),
      purchasePlanLine(2027, civil('2027-03-10'), euros(1600), 'computers', 'Laptop'),
      dividendPlanLine(2027, 6, euros(5000)),
    ])
    expect(lines(store)).toEqual(['owner pay floor from January', 'owner pay board from 2027-06-05', 'purchase Laptop on 2027-03-10', 'dividend 6 500000'])
    expect(recordsOfKindIn(store.state.records!, PLAN_RECORDS).records[2]?.fields.date?.text).toBe('2027-03-10')
  })

  it('refuses what the plan guards stop, naming why', async () => {
    const { store } = await harnessOf(used, grids())
    await expect(addLines(store, [ownerPayPlanLine(2027, 'board', civil('2027-06-05'))])).rejects.toThrow(
      'Nothing was written. The owner pay switches to board on 2027-06-05, but no row without a date sets it before then. Add the scenario 2027 starts with.',
    )
    await expect(addLines(store, [ownerPayPlanLine(2027, 'old', null)])).rejects.toThrow('The owner pay of 2027 names old, a scenario for 2026.')
    await expect(addLines(store, [dividendPlanLine(2027, 6, euros(5000)), dividendPlanLine(2027, 9, euros(1000))])).rejects.toThrow(
      'The plan for 2027 pays a dividend in month 6 and month 9. Plan one payout a year.',
    )
    expect(lines(store)).toEqual([])
  })

  it('refuses a scenario change that the plan naming it could no longer work out', async () => {
    const base = grids([PLAN_HEADER, [2027, '', 'owner_pay_scenario', 'floor', '', '', ''], [2027, '', 'owner_pay_scenario', 'board', '', serialFromCivilDate(civil('2027-06-15')), '']])
    const { store } = await harnessOf(used, { ...base, scenarios: base.scenarios!.map((row) => (row[0] === 'board' ? [...row, serialFromCivilDate(civil('2027-07-01'))] : row)) })
    // The board scenario may pay a salary to June on its own, but the plan switches to it on 15
    // June, so the year would pay two salaries in June.
    const salary = scenarioRowOfComponent('board', '', 2027, { component: 'salary_gross', gross: euros(2000), from: null, to: civil('2027-06-30') })
    await expect(store.write('Component added', (unit) => unit.of(SCENARIO_WRITES).add(salary))).rejects.toThrow(
      'The plan tab: The owner pay of 2027: The floor salary to 2027-06-14 and the salary of 2000.00 from 2027-06-15 to 2027-06-30 both pay a salary in 2027-06. A salary can change only from the first of a month.',
    )
  })
})
