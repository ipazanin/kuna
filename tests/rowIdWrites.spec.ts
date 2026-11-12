import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { LEDGER_WRITES } from '../src/apps/company/imports/application/ledgerWrites'
import { giveRowsIds } from '../src/apps/company/workbook/application/rowIdWrites'
import { writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { rowsWithoutId } from '../src/apps/company/workbook/domain/ledgerReading'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { ID_FIELD } from '../src/shared/storage/domain/recordCodec'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { ASSET_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { euros } from './fixtures/ledger'
import { withIds } from './fixtures/rowIds'
import { AN_ID, browserHarness, documentOfGrids, driveHarness, forgetCaches, workbookGrids } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** The test books as they stood before imports gave every ledger row an id. */
function booksWithoutRowIds(): WorkbookDocument {
  const document = documentOfGrids({
    ...workbookGrids(),
    categories: [
      ['category', 'family', 'bucket'],
      ['ai-services', 'operating', 'operating'],
      ['equipment', 'operating', 'operating'],
      ['owner-loan-out', 'owner', 'owner-pay'],
      ['revenue', 'income', 'income'],
    ],
    splits: [['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note']],
    assets: withIds('asset', [
      ['asset', 'bought', 'cost_net', 'group', 'ledger_reference'],
      ['Desk', 46298, 80, 'equipment', 'REF-2'],
      ['Lamp', 46300, 30, 'equipment', 'Card purchase'],
    ]),
  })
  const ledger = (document.records['ledger-row'] ?? []).map(({ [ID_FIELD]: _id, ...fields }) => fields)
  return { ...document, records: { ...document.records, 'ledger-row': ledger } }
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('row ids in %s', (_name, harnessOf) => {
  it('gives every ledger row without an id one in one write, which Undo takes back', async () => {
    const { store } = await harnessOf(used, booksWithoutRowIds())
    const without = rowsWithoutId(store.state.workbook!.transactions).length
    expect(without).toBe(store.state.workbook!.transactions.length)

    const receipt = await store.write('Ids', (unit) => giveRowsIds(unit, store.state.records!))

    expect(receipt?.records.filter(({ change }) => change.kind.name === 'ledger-row')).toHaveLength(without)
    expect(store.state.workbook!.transactions.map((row) => row.rowId)).toEqual(store.state.workbook!.transactions.map(() => AN_ID))
    expect(new Set(store.state.workbook!.transactions.map((row) => row.rowId)).size).toBe(without)

    await store.undo(store.state.writes[0]!)

    expect(rowsWithoutId(store.state.workbook!.transactions)).toHaveLength(without)
  })

  it('links in the same write each split part and each asset that finds exactly one row by its content, and Undo takes the links back', async () => {
    const { store } = await harnessOf(used, booksWithoutRowIds())
    const model = store.state.workbook!.transactions.find((row) => row.counterparty === 'MODEL API INC')!
    const drafts = [
      { amount: euros(-12), category: 'ai-services', note: '', opened: null },
      { amount: euros(-8), category: 'owner-loan-out', note: '', opened: null },
    ]
    await store.write('Split', (unit) => writeSplit(unit, model, { parts: [], refused: false, unreadable: 0 }, drafts, store.state.workbook!.categories))
    const assetRows = () => recordsOf(recordsOfKindIn(store.state.records!, ASSET_RECORDS)).map((asset) => [asset.name, asset.rowId])

    await store.write('Ids', (unit) => giveRowsIds(unit, store.state.records!))

    const rowIdOf = (counterparty: string) => store.state.workbook!.transactions.find((row) => row.counterparty === counterparty)!.rowId
    expect(recordsOf(store.state.records!.splits).filter((part) => part.key.rowId === null)).toHaveLength(0)
    expect(recordsOf(store.state.records!.splits).map((part) => part.key.rowId)).toEqual([rowIdOf('MODEL API INC'), rowIdOf('MODEL API INC')])
    expect(store.state.workbook!.splits.map((split) => split.row.id)).toEqual([model.id])
    // The lamp's reference is in the text of two card purchases, so it stays matched by content.
    expect(assetRows()).toEqual([
      ['Desk', rowIdOf('Desk Co')],
      ['Lamp', null],
    ])

    await store.undo(store.state.writes[0]!)

    expect(recordsOf(store.state.records!.splits).map((part) => part.key.rowId)).toEqual([null, null])
    expect(assetRows()).toEqual([
      ['Desk', null],
      ['Lamp', null],
    ])
  })

  it('refuses to change the id a row was given', async () => {
    const { store } = await harnessOf(used, booksWithoutRowIds())
    await store.write('Ids', (unit) => giveRowsIds(unit, store.state.records!))
    const [entry] = recordsOf(store.state.records!.ledger)

    await expect(store.write('Other id', (unit) => unit.of(LEDGER_WRITES).change(entry!, { ...entry!, rowId: 'another' }))).rejects.toThrow(WorkbookWriteRefused)
  })
})
