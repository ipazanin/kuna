import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { OWNER_ADVANCE_WRITES } from '../src/packs/hr-doo/domain/hrDooWrites'
import { cellsOf, removeRows } from './fixtures/recordWrites'
import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { forgetCaches, googleHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

describe('a deleted row of a tab that carries ids', () => {
  it('comes back with the same id when its delete is undone', async () => {
    const { store } = await googleHarness(used, fakeWorkbookValues('google'))
    const [first] = store.state.snapshot!['owner-advances']
    const id = first!.cells.id

    const receipt = await removeRows(store, OWNER_ADVANCE_WRITES, first!.sheetRow)
    expect(cellsOf(receipt, 'remove')[0]?.id).toBe(id)
    await store.undo(store.state.writes[0]!)

    expect(store.state.snapshot!['owner-advances'].filter((row) => row.cells.id === id)).toHaveLength(1)
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('stays out while the tab holds its id again, so Undo makes no copy', async () => {
    const { store, sheets } = await googleHarness(used, fakeWorkbookValues('google'))
    const [first] = store.state.snapshot!['owner-advances']
    const copy = [...sheets.grids['owner-advances']![1]!]

    await removeRows(store, OWNER_ADVANCE_WRITES, first!.sheetRow)
    sheets.grids['owner-advances']!.push(copy)
    const grid = structuredClone(sheets.grids['owner-advances'])

    await expect(store.undo(store.state.writes[0]!)).rejects.toThrow('is in the workbook already, so it is not added again.')
    expect(sheets.grids['owner-advances']).toEqual(grid)
  })
})
