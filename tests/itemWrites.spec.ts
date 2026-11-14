import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { writeImport } from '../src/apps/company/imports/application/importStatements'
import type { ImportDryRun } from '../src/apps/company/imports/domain/importDryRun'
import { writeOwnerShare } from '../src/apps/company/owner-share/application/ownerShareWrites'
import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import { deleteCategoryInto } from '../src/apps/company/settings/application/namedRecordWrites'
import { fileRows } from '../src/apps/company/transactions/application/fileRows'
import { ITEM_WRITES } from '../src/apps/company/transactions/application/itemWrites'
import { removeSplit, writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { confirmation, recategorisation } from '../src/apps/company/transactions/domain/verdictChanges'
import { moveToItems } from '../src/apps/company/workbook/application/rowIdWrites'
import { ITEM_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { ledgerIdOf } from '../src/apps/company/workbook/domain/ledgerReading'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { storedSplitOf, storesItems } from '../src/apps/company/workbook/domain/rowItems'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import { documentOfTabs } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import { COMPANY_APP } from '../src/apps/company/workbook/domain/companyApp'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { moneyFromAmount } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { browserHarness, documentOfGrids, forgetCaches, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

type Store = WriteBackHarness['store']

/** The test books with a category to move rows into and one with an owner share, as a file of either shape holds them. */
function grids() {
  return {
    ...workbookGrids(),
    categories: [
      ['category', 'family', 'bucket', 'owner_share'],
      ['equipment', 'operating', 'operating', ''],
      ['ai-services', 'operating', 'operating', '50'],
      ['office', 'operating', 'operating', ''],
      ['revenue', 'income', 'income', ''],
    ],
  }
}

/** A store of the test books, moved to the items tab first when `onItemsTab` says so. */
async function storeOf(onItemsTab: boolean): Promise<Store> {
  const { store } = await browserHarness(used, documentOfGrids(grids()))
  if (onItemsTab) await store.write('Moved', (unit) => moveToItems(unit, books(store)))
  expect(storesItems(store.state.records!)).toBe(onItemsTab)
  return store
}

function books(store: Store): CompanyBooks {
  return { records: store.state.records!, workbook: store.state.workbook! }
}

function rowOf(store: Store, counterparty: string): Transaction {
  return store.state.workbook!.transactions.find((row) => row.counterparty === counterparty)!
}

/** Each row as it counts: its category and share, and its parts while it is split. */
function filed(store: Store, counterparty: string): unknown {
  const row = rowOf(store, counterparty)
  const split = store.state.workbook!.splits.find((held) => held.row.id === row.id)
  return split === undefined ? [row.category, row.ownerShare, row.flaggedBy] : split.parts.map((part) => [part.amount, part.category, part.note, part.ownerShare])
}

function split(store: Store, counterparty: string, parts: readonly (readonly [number, string, string])[]) {
  const row = rowOf(store, counterparty)
  const stored = storedSplitOf(store.state.records!, store.state.workbook!, row)
  const drafts = parts.map(([amount, category, note], index) => ({ amount: euros(amount), category, note, opened: stored.parts[index] ?? null }))
  return store.write('Split', (unit) => writeSplit(unit, store.state.records!, row, stored, drafts, store.state.workbook!.categories))
}

describe.each([
  ['books from before items', false],
  ['books on the items tab', true],
] as const)('the writers on %s', (_shape, onItemsTab) => {
  it('splits a row, changes its split and takes it off, each read back the same', async () => {
    const store = await storeOf(onItemsTab)

    await split(store, 'MODEL API INC', [
      [-12, 'ai-services', 'Seats'],
      [-8, 'office', 'Paper'],
    ])
    expect(filed(store, 'MODEL API INC')).toEqual([
      [euros(-12), 'ai-services', 'Seats', 50],
      [euros(-8), 'office', 'Paper', null],
    ])
    await split(store, 'MODEL API INC', [
      [-15, 'ai-services', 'Seats'],
      [-5, 'office', 'Paper'],
    ])
    expect(filed(store, 'MODEL API INC')).toEqual([
      [euros(-15), 'ai-services', 'Seats', 50],
      [euros(-5), 'office', 'Paper', null],
    ])

    const row = rowOf(store, 'MODEL API INC')
    await store.write('Removed', (unit) => removeSplit(unit, books(store), row, storedSplitOf(store.state.records!, store.state.workbook!, row)))

    expect(filed(store, 'MODEL API INC')).toEqual(['ai-services', 50, 'ivan'])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('files a row of one item, keeps a split row in its split when a person confirms it, and refuses to file it elsewhere', async () => {
    const store = await storeOf(onItemsTab)
    const { settings } = store.state.workbook!
    await store.write('Filed', (unit) => fileRows(unit, books(store), [recategorisation(rowOf(store, 'GADGET CORNER'), 'office', settings)], store.state.workbook!.categories))
    expect(filed(store, 'GADGET CORNER')).toEqual(['office', null, 'ivan'])

    await split(store, 'MODEL API INC', [
      [-12, 'ai-services', ''],
      [-8, 'office', ''],
    ])
    const model = rowOf(store, 'MODEL API INC')
    await store.write('Confirmed', (unit) => fileRows(unit, books(store), [confirmation(model, settings)!], store.state.workbook!.categories))
    expect([rowOf(store, 'MODEL API INC').flaggedBy, store.state.workbook!.splits.some((held) => held.row.id === model.id)]).toEqual(['ivan', true])

    await expect(
      store.write('Filed', (unit) => fileRows(unit, books(store), [recategorisation(rowOf(store, 'MODEL API INC'), 'equipment', settings)], store.state.workbook!.categories)),
    ).rejects.toThrow('is split in parts, each in its own category')
  })

  it('sets the share of a row of one item and of a part of a split row', async () => {
    const store = await storeOf(onItemsTab)
    const desk = rowOf(store, 'Desk Co')
    await store.write('Shared', (unit) => writeOwnerShare(unit, store.state.records!, { holder: 'ledger', id: desk.id }, ownerShareOf(30)))
    expect(filed(store, 'Desk Co')).toEqual(['equipment', 30, 'human'])

    await split(store, 'MODEL API INC', [
      [-12, 'ai-services', ''],
      [-8, 'office', ''],
    ])
    const [, office] = store.state.workbook!.splits.find((held) => held.row.id === rowOf(store, 'MODEL API INC').id)!.parts
    await store.write('Shared', (unit) => writeOwnerShare(unit, store.state.records!, { holder: 'split-part', id: office!.id }, ownerShareOf(20)))
    expect(filed(store, 'MODEL API INC')).toEqual([
      [euros(-12), 'ai-services', '', 50],
      [euros(-8), 'office', '', 20],
    ])
  })

  it('moves the rows and parts of a deleted category into another, and Undo puts them back', async () => {
    const store = await storeOf(onItemsTab)
    await split(store, 'MODEL API INC', [
      [-12, 'ai-services', ''],
      [-8, 'equipment', ''],
    ])
    const equipment = recordsOf(store.state.records!.categories).find((category) => category.slug === 'equipment')!

    await store.write('Moved', (unit) => deleteCategoryInto(unit, store.state.records!, equipment, 'office', store.state.workbook!.categories))

    expect([filed(store, 'Desk Co'), filed(store, 'MODEL API INC')]).toEqual([
      ['office', null, 'human'],
      [
        [euros(-12), 'ai-services', '', 50],
        [euros(-8), 'office', '', null],
      ],
    ])
    await store.undo(store.state.writes[0]!)
    expect(filed(store, 'Desk Co')).toEqual(['equipment', null, 'human'])
  })

  it('imports a row with its one item filed as its entry names, and Undo takes both back', async () => {
    const store = await storeOf(onItemsTab)
    const newest = rowOf(store, 'GADGET CORNER')
    const fields = {
      account: 'main',
      date: civil('2026-10-06'),
      statement: 's-003',
      counterparty: 'PRINT SHOP',
      counterpartyIban: '',
      description: 'Card purchase',
      amount: euros(-10),
      balance: moneyFromAmount(990),
      category: 'office',
      flaggedBy: 'rule',
      reference: 'REF-5',
      signals: newest.signals,
      reviewReasons: [],
      ownerShare: null,
      rowId: 'printed-row',
    }
    const entry: LedgerEntry = { ...fields, id: ledgerIdOf(fields) }
    const run = { accounts: [], removed: [], added: [entry], repayments: [], newRows: 1, statements: [] } as unknown as ImportDryRun

    await store.write('Imported', (unit) => writeImport(unit, run, store.state.records!))

    expect(filed(store, 'PRINT SHOP')).toEqual(['office', null, 'rule'])
    expect(recordsOf(store.state.records!.items).filter((item) => item.row === 'printed-row')).toEqual(
      onItemsTab ? [{ row: 'printed-row', amount: euros(-10), category: 'office', note: '', ownerShare: null, id: recordIdOf(ITEM_RECORDS, 'printed-row') }] : [],
    )
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.transactions.some((row) => row.counterparty === 'PRINT SHOP')).toBe(false)
  })
})

describe('the items tab', () => {
  it("refuses items that miss their row's amount, and parts without a category", async () => {
    const store = await storeOf(true)
    const [item] = recordsOf(store.state.records!.items).filter((held) => held.row === rowOf(store, 'Desk Co').rowId)

    await expect(store.write('Changed', (unit) => unit.of(ITEM_WRITES).change(item!, { ...item!, amount: euros(-90) }))).rejects.toThrow(WorkbookWriteRefused)
    await expect(
      store.write('Split', (unit) => {
        unit.of(ITEM_WRITES).change(item!, { ...item!, amount: euros(-90) })
        unit.of(ITEM_WRITES).add({ ...item!, amount: euros(-10), category: '', id: recordIdOf(ITEM_RECORDS, 'blank') })
      }),
    ).rejects.toThrow('has no category, which only the one part of a row may lack')
  })

  it("repeats each item's ledger day, account and counterparty in an export, which an import of it leaves out", async () => {
    const store = await storeOf(true)
    const document = store.state.snapshot!.document
    const tabs = tabsOfDocument(document)
    const desk = rowOf(store, 'Desk Co')
    const row = tabs.items.find((sheetRow) => sheetRow.cells['row_id'] === desk.rowId)

    expect(row?.cells).toMatchObject({ date: 46298, account: 'main', counterparty: 'Desk Co', amount: -100, category: 'equipment' })
    const read = (records: readonly Readonly<Record<string, unknown>>[] | undefined) => (records ?? []).map((item) => ({ ...item, amount: Number(item['amount']) }))
    expect(read(documentOfTabs(COMPANY_APP, tabs, document.savedAt).records['item'])).toEqual(read(document.records['item']))
  })
})
