import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { itemsMoveBlockers, moveToItems } from '../src/apps/company/workbook/application/rowIdWrites'
import { storesItems } from '../src/apps/company/workbook/domain/rowItems'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { ownerAdvances } from '../src/apps/company/packs/hr-doo/domain/ownerAdvances'
import { presentedWorkbook } from '../src/apps/company/transactions/domain/presentedWorkbook'
import { euros } from './fixtures/ledger'
import { fakeWorkbookDocument, fakeWorkbookDocumentBeforeItems } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const SAVED = '2026-10-16T09:00:00.000Z'

/** The kinds the move writes, as the file holds them. */
function movedKinds(document: WorkbookDocument): Readonly<Record<string, unknown>> {
  const kinds = ['ledger-row', 'split-part', 'item', 'hr-doo.asset', 'hr-doo.trip']
  return Object.fromEntries(kinds.map((kind) => [kind, document.records[kind] ?? []]))
}

describe('moving books from before items to the items tab', () => {
  it.each([null, 'one-employee', 'five-employees'])('turns the fake books before items into the fake books on the items tab, staff %s', async (variant) => {
    const staff = variant === null ? null : fakeStaffOf(variant)
    const { store, held } = await browserHarness(used, fakeWorkbookDocumentBeforeItems(SAVED, 'browser', staff))
    expect(storesItems(store.state.records!)).toBe(false)
    expect(itemsMoveBlockers({ records: store.state.records!, workbook: store.state.workbook! })).toEqual([])

    await store.write('Moved', (unit) => moveToItems(unit, { records: store.state.records!, workbook: store.state.workbook! }))

    expect(storesItems(store.state.records!)).toBe(true)
    expect(movedKinds(await held())).toEqual(movedKinds(fakeWorkbookDocument(SAVED, 'browser', staff)))
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('reads the same figures before and after, and Undo puts the books back as they were', async () => {
    const before = fakeWorkbookDocumentBeforeItems(SAVED, 'browser')
    const { store, held } = await browserHarness(used, before)
    const read = store.state.workbook!
    const filed = (rows: typeof read.transactions) => rows.map((row) => [row.id, row.amount, row.category, row.ownerShare])

    await store.write('Moved', (unit) => moveToItems(unit, { records: store.state.records!, workbook: store.state.workbook! }))

    const moved = store.state.workbook!
    const partsOf = (splits: typeof read.splits) => new Map(splits.map((held) => [held.row.id, held.parts.map((part) => [part.amount, part.category, part.note, part.ownerShare])]))
    const repayment = moved.splits.find((held) => held.row.description === 'Refund of the design tool and the printer paper')!
    expect(partsOf(moved.splits.filter((held) => held !== repayment))).toEqual(partsOf(read.splits))
    expect(repayment.parts.map((part) => [part.amount, part.note])).toEqual([
      [euros(-89), 'Design tool, annual plan on the owner’s card'],
      [euros(-34.2), 'Printer paper'],
    ])
    const split = new Set(moved.splits.map((held) => held.row.id))
    expect(filed(moved.transactions.filter((row) => !split.has(row.id)))).toEqual(filed(read.transactions.filter((row) => !split.has(row.id))))
    const advancesOf = (workbook: typeof read) => {
      const books = hrDooWorkbook(presentedWorkbook(workbook))
      const book = ownerAdvances(books.ownerAdvances, books.transactions, books.categories, books.repaidBy)
      return [
        book.advances.map((line) => [line.advance.id, line.remaining, line.status, line.repaidOn, line.repayments.map((share) => share.applied)]),
        book.unaccounted.map((line) => [line.payment.id, line.amount]),
      ]
    }
    expect(hrDooWorkbook(moved).repaidBy).toBeDefined()
    expect(advancesOf(moved)).toEqual(advancesOf(read))

    await store.undo(store.state.writes[0]!)

    expect(storesItems(store.state.records!)).toBe(false)
    expect(movedKinds(await held())).toEqual(movedKinds(before))
  })

  it('names what keeps books whose splits the guards refuse from moving', async () => {
    const before = fakeWorkbookDocumentBeforeItems(SAVED, 'browser')
    const parts = (before.records['split-part'] ?? []).map((fields) => (fields['note'] === 'Workshop facilitation' ? { ...fields, amount: '-300' } : fields))
    const { store } = await browserHarness(used, { ...before, records: { ...before.records, 'split-part': parts } })

    expect(itemsMoveBlockers({ records: store.state.records!, workbook: store.state.workbook! }).map((blocker) => blocker.kind)).toEqual(['refused-part', 'refused-part'])
  })

  it('has nothing to move in books that keep their items already', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser'))

    expect(storesItems(store.state.records!)).toBe(true)
    expect(itemsMoveBlockers({ records: store.state.records!, workbook: store.state.workbook! })).toEqual([])
  })
})
