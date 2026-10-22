import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { rowsWithoutIds } from '../src/features/workbook/application/rowIds'
import { canUndo } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import { OWNER_ADVANCE_ROWS } from '../src/features/workbook/application/ownerAdvanceRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { TABS_WITH_IDS } from '../src/features/workbook/infrastructure/workbookTemplate'
import { AN_ID, cellData, excelHarness, forgetCaches, googleHarness, sentRequests } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The fake workbook as a Sheet from before ids: the seven tabs without the id column. */
function oldTabs(): Record<string, CellValue[][]> {
  return fakeWorkbookValues('google', false)
}

/** A grid without one column, a blank cell as '' and no blanks at the end of a row, as Google returns it. */
function withoutColumn(grid: readonly (readonly (CellValue | null)[])[], column: number): CellValue[][] {
  return grid.map((row) => {
    const cells = row.filter((_, index) => index !== column).map((cell) => cell ?? '')
    while (cells.at(-1) === '') cells.pop()
    return cells
  })
}

/** Every id the rows of the seven tabs hold on screen, a row without one as a blank. */
function idsOnScreen(store: WorkbookStore): string[] {
  return TABS_WITH_IDS.flatMap((tab) => store.state.snapshot![tab].map((row) => String(row.cells.id ?? '')))
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('ids added to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('reads rows without an id, then gives each a distinct one, which the records read, and then nothing lacks one', async () => {
    const { store } = await harnessOf(used, oldTabs())
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.workbook!.ownerAdvances.map((advance) => advance.id)).toEqual([undefined, undefined, undefined])
    const lacking = rowsWithoutIds(store.state.snapshot!)
    expect(lacking.map((tab) => tab.tab)).toEqual(['outgoing-plan', 'owner-advances', 'assets', 'year-end', 'plan', 'splits'])

    const given = await store.addMissingIds()

    expect(given).toEqual(lacking)
    const ids = idsOnScreen(store)
    expect(ids).toHaveLength(lacking.reduce((sum, tab) => sum + tab.rows, 0))
    expect(ids.every((id) => AN_ID.asymmetricMatch(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(rowsWithoutIds(store.state.snapshot!)).toEqual([])
    expect(store.state.workbook!.ownerAdvances.map((advance) => advance.id)).toEqual(store.state.snapshot!['owner-advances'].map((row) => row.cells.id))
    expect(store.state.workbook!.splits.flatMap((split) => split.parts).every((part) => part.id !== undefined)).toBe(true)
    expect(store.state.workbook!.problems).toEqual([])
    expect(store.state.writes).toMatchObject([{ kind: 'ids', given: lacking }])
    expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(false)

    await expect(store.addMissingIds()).resolves.toEqual([])
    expect(store.state.writes).toHaveLength(1)
  })

  it('keeps the id a row already has and gives one only to the rows without', async () => {
    const tabs = oldTabs()
    const [header = [], ...rows] = tabs['owner-advances']!
    const { store } = await harnessOf(used, { ...tabs, 'owner-advances': [[...header, 'id'], [...rows[0]!, 'kept-by-hand'], ...rows.slice(1)] })

    expect(rowsWithoutIds(store.state.snapshot!).find((tab) => tab.tab === 'owner-advances')?.rows).toBe(rows.length - 1)
    await store.addMissingIds()

    expect(store.state.snapshot!['owner-advances'].map((row) => row.cells.id)).toEqual(['kept-by-hand', ...rows.slice(1).map(() => AN_ID)])
  })
})

describe('ids added to a Google Sheet', () => {
  it('writes the id headers and every id in one batchUpdate, changes no other cell, and a second sync offers nothing and keeps the ids', async () => {
    const tabs = oldTabs()
    const { store, sheets } = await googleHarness(used, tabs)

    await store.addMissingIds()

    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    const requests = sentRequests(sheets)
    expect(requests.every((request) => 'updateCells' in request)).toBe(true)
    for (const tab of ['outgoing-plan', 'owner-advances', 'assets', 'year-end', 'plan', 'splits']) {
      const header = sheets.grids[tab]![0]!
      expect(header.at(-1), tab).toBe('id')
      expect(header.filter((name) => name === 'id'), tab).toHaveLength(1)
    }
    for (const [tab, grid] of Object.entries(sheets.grids)) {
      const idColumn = (TABS_WITH_IDS as readonly string[]).includes(tab) ? grid[0]!.indexOf('id') : -1
      expect(withoutColumn(grid, idColumn), tab).toEqual(withoutColumn(tabs[tab]!, -1))
    }
    const given = idsOnScreen(store)

    await store.sync()

    expect(rowsWithoutIds(store.state.snapshot!)).toEqual([])
    expect(idsOnScreen(store)).toEqual(given)
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('adds a column to a tab whose grid has none free, and puts the id after a column with cells but no header', async () => {
    const tabs = oldTabs()
    const [header = [], ...rows] = tabs['owner-advances']!
    const { store, sheets } = await googleHarness(used, { ...tabs, 'owner-advances': [header, [...rows[0]!, 'a note without a header'], ...rows.slice(1)] })
    const advances = (await sheets.sheetGrids()).get('owner-advances')!.sheetId
    sheets.columnCounts['owner-advances'] = header.length + 1

    await store.addMissingIds()

    const onAdvances = sentRequests(sheets).filter((request) =>
      'appendDimension' in request ? request.appendDimension.sheetId === advances : 'updateCells' in request && request.updateCells.start.sheetId === advances && request.updateCells.start.rowIndex === 0,
    )
    expect(onAdvances).toEqual([
      { appendDimension: { sheetId: advances, dimension: 'COLUMNS', length: 1 } },
      { updateCells: { start: { sheetId: advances, rowIndex: 0, columnIndex: header.length + 1 }, rows: [{ values: [cellData('id')] }], fields: 'userEnteredValue' } },
    ])
    expect(sheets.columnCounts['owner-advances']).toBe(header.length + 2)
    expect(sheets.grids['owner-advances']![1]!.slice(header.length)).toEqual(['a note without a header', AN_ID])
  })
})

describe('a deleted row of a tab that carries ids', () => {
  it('comes back with the same id when its delete is undone', async () => {
    const { store } = await googleHarness(used, fakeWorkbookValues('google'))
    const [first] = store.state.snapshot!['owner-advances']
    const id = first!.cells.id

    const receipt = await store.changeRows(OWNER_ADVANCE_ROWS, { added: [], changed: [], removed: [{ sheetRow: first!.sheetRow, cells: rowCellsOf(first!, OWNER_ADVANCE_ROWS.columns) }] })
    expect(receipt?.removed[0]?.cells.id).toBe(id)
    await store.undo(store.state.writes[0]!)

    expect(store.state.snapshot!['owner-advances'].find((row) => row.sheetRow === first!.sheetRow)?.cells.id).toBe(id)
    expect(rowsWithoutIds(store.state.snapshot!)).toEqual([])
  })
})
