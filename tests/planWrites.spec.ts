import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { RowAt } from '../src/features/workbook/domain/rowChanges'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { PLAN_ROWS, categoryPlanCells, dividendPlanCells, ownerPayPlanCells, purchasePlanCells, replacedPlanRows } from '../src/packs/hr-doo/application/planRows'
import { SCENARIO_ROWS, componentCells } from '../src/packs/hr-doo/application/scenarioRows'
import { serialFromCivilDate } from '../src/shared/calendar/civilDate'
import { civil, euros } from './fixtures/ledger'
import { AN_ID, excelHarness, forgetCaches, googleHarness, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

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
    plan,
  }
}

function rows(store: WorkbookStore): RowAt[] {
  return (store.state.snapshot?.plan ?? []).map((row) => ({ sheetRow: row.sheetRow, cells: rowCellsOf(row, PLAN_ROWS.columns) }))
}

function lines(store: WorkbookStore): string[] {
  return (store.state.workbook?.planLines ?? []).map((line) =>
    line.kind === 'owner-pay-scenario' ? `owner pay ${line.scenario} from ${line.from ?? 'January'}` : line.kind === 'purchase' ? `purchase ${line.note} on ${line.date}` : `${line.item} ${line.month ?? 'every'} ${line.amount}`,
  )
}

describe('the plan tab on a Google Sheet without one', () => {
  it('refuses until the person agrees, then adds the tab with the template header and the row', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, { ...workbookGrids(), scenarios: grids().scenarios! })
    const change = { added: [categoryPlanCells(2027, null, 'ai-services', euros(150))], changed: [], removed: [] }
    await expect(store.changeRows(PLAN_ROWS, change)).rejects.toThrow(new WorkbookWriteRefused('The workbook has no plan tab, so nothing was written.'))

    await store.changeRows(PLAN_ROWS, change, true)
    expect(writtenRanges()).toEqual(['plan!A1:H1'])
    expect(sheets.grids.plan).toEqual([[...PLAN_HEADER, 'id'], [2027, null, 'ai-services', 150, null, null, null, AN_ID]])
    expect(lines(store)).toEqual(['ai-services every 15000'])

    await store.undo(store.state.writes[0]!)
    expect(lines(store)).toEqual([])
    expect(sheets.grids.plan?.[0]).toEqual([...PLAN_HEADER, 'id'])
  })

  it('finds a plan row again by its cells after a row was inserted above it, and writes only the plan columns that change', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, grids([[...PLAN_HEADER, 'source'], [2027, '', 'ai-services', 150, '', '', '', 'Quote 12']]))
    const held = rows(store).map((row) => ({ key: 'every', cells: row }))
    sheets.grids.plan!.splice(1, 0, [2027, 3, 'consulting', 400, 'Inserted in the Sheet', '', '', ''])

    await store.changeRows(PLAN_ROWS, replacedPlanRows(held, [{ key: 'every', cells: categoryPlanCells(2027, null, 'ai-services', euros(175)) }]))

    expect(writtenRanges()).toEqual(['plan!D3'])
    expect(sheets.grids.plan![2]).toEqual([2027, '', 'ai-services', 175, '', '', '', 'Quote 12'])
    expect(sheets.grids.plan![1]?.[2]).toBe('consulting')
  })

  it('refuses a purchase on an older plan tab with no date or group column', async () => {
    const { store } = await googleHarness(used, grids([['year', 'month', 'item', 'amount', 'note']]))
    await expect(store.changeRows(PLAN_ROWS, { added: [purchasePlanCells(2027, civil('2027-03-10'), euros(1600), 'computers', 'Laptop')], changed: [], removed: [] })).rejects.toThrow(
      'The plan tab has no "date", "group" column for what this change writes.',
    )
  })
})

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('plan writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('plans a category for every month and a month of its own, changes it and clears it', async () => {
    const { store } = await harnessOf(used, grids())
    await store.changeRows(PLAN_ROWS, replacedPlanRows([], [
      { key: 'every', cells: categoryPlanCells(2027, null, 'ai-services', euros(150)) },
      { key: '1', cells: categoryPlanCells(2027, 1, 'ai-services', euros(900), 'Yearly seats') },
    ]))
    expect(lines(store)).toEqual(['ai-services every 15000', 'ai-services 1 90000'])

    const held = rows(store).map((row) => ({ key: row.cells.month === '' ? 'every' : String(row.cells.month), cells: row }))
    const change = replacedPlanRows(held, [{ key: 'every', cells: categoryPlanCells(2027, null, 'ai-services', euros(175)) }])
    // The every-month row changes its amount only, and January's row goes.
    expect(change.changed.map((entry) => entry.after.amount)).toEqual([175])
    expect(change.removed.map((entry) => entry.cells.month)).toEqual([1])
    await store.changeRows(PLAN_ROWS, change)
    expect(lines(store)).toEqual(['ai-services every 17500'])

    await store.undo(store.state.writes[0]!)
    expect(lines(store)).toEqual(['ai-services every 15000', 'ai-services 1 90000'])
  })

  it('writes the owner pay with a switch day, a purchase and a dividend', async () => {
    const { store } = await harnessOf(used, grids())
    await store.changeRows(PLAN_ROWS, {
      added: [
        ownerPayPlanCells(2027, 'floor', null),
        ownerPayPlanCells(2027, 'board', civil('2027-06-05')),
        purchasePlanCells(2027, civil('2027-03-10'), euros(1600), 'computers', 'Laptop'),
        dividendPlanCells(2027, 6, euros(5000)),
      ],
      changed: [],
      removed: [],
    })
    expect(lines(store)).toEqual(['owner pay floor from January', 'owner pay board from 2027-06-05', 'purchase Laptop on 2027-03-10', 'dividend 6 500000'])
    expect(rows(store)[2]?.cells.date).toBe(serialFromCivilDate(civil('2027-03-10')))
  })

  it('refuses what the plan guards stop, naming why', async () => {
    const { store } = await harnessOf(used, grids())
    await expect(store.changeRows(PLAN_ROWS, { added: [ownerPayPlanCells(2027, 'board', civil('2027-06-05'))], changed: [], removed: [] })).rejects.toThrow(
      'Nothing was written. Row 2 switches the owner pay on 2027-06-05, but no row without a date sets it before then. Add the scenario 2027 starts with.',
    )
    await expect(store.changeRows(PLAN_ROWS, { added: [ownerPayPlanCells(2027, 'old', null)], changed: [], removed: [] })).rejects.toThrow('Row 2 names old, a scenario for 2026, in the plan for 2027.')
    await expect(store.changeRows(PLAN_ROWS, { added: [dividendPlanCells(2027, 6, euros(5000)), dividendPlanCells(2027, 9, euros(1000))], changed: [], removed: [] })).rejects.toThrow(
      'Rows 2 and 3 each plan a dividend for 2027. Plan one payout a year.',
    )
    await expect(store.changeRows(PLAN_ROWS, { added: [{ ...purchasePlanCells(2027, civil('2027-03-10'), euros(1600), 'computers', 'Laptop'), group: '' }], changed: [], removed: [] })).rejects.toThrow(
      'The new plan row would be left out: no asset group.',
    )
    expect(lines(store)).toEqual([])
  })

  it('refuses a scenario change that the plan naming it could no longer work out', async () => {
    const base = grids([PLAN_HEADER, [2027, '', 'owner_pay_scenario', 'floor', '', '', ''], [2027, '', 'owner_pay_scenario', 'board', '', serialFromCivilDate(civil('2027-06-15')), '']])
    const { store } = await harnessOf(used, { ...base, scenarios: base.scenarios!.map((row) => (row[0] === 'board' ? [...row, serialFromCivilDate(civil('2027-07-01'))] : row)) })
    // The board scenario may pay a salary to June on its own, but the plan switches to it on 15
    // June, so the year would pay two salaries in June.
    const salary = componentCells('board', 2027, { component: 'salary_gross', gross: euros(2000), from: null, to: civil('2027-06-30') })
    await expect(store.changeRows(SCENARIO_ROWS, { added: [salary], changed: [], removed: [] })).rejects.toThrow(
      'The plan tab: The owner pay of rows 2 and 3: Rows 2 and 5 both pay a salary in 2027-06. A salary can change only from the first of a month.',
    )
  })
})
