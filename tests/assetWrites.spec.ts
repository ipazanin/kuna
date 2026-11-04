import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ASSET_WRITES, VALUATION_WRITES, newAsset, newValuation, removeAsset } from '../src/apps/assets/asset/application/assetWrites'
import type { AssetsBooks } from '../src/apps/assets/workbook/domain/assetsBooks'
import { emptyAssetsDocument } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { recordsChangeInWords } from '../src/shared/storage/presentation/recordsChangeInWords'
import { civil, euros } from './fixtures/ledger'
import { ASSETS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const FLAT = newAsset({
  name: ' Flat in Zagreb ',
  kind: 'home',
  bought: civil('2025-03-15'),
  price: euros(200_000),
  region: 'zagreb',
  firstRegistration: null,
  loan: null,
  note: '',
})
const APPRAISAL = newValuation({ asset: FLAT.id, date: civil('2026-01-10'), value: euros(230_000), note: " The bank's appraisal " })
const GUESS = newValuation({ asset: FLAT.id, date: civil('2026-06-01'), value: euros(235_000), note: '' })

/** A store whose file holds the flat and its two valuations. */
async function storeWithFlat(): Promise<WorkbookStore<AssetsBooks>> {
  const { store } = await browserHarness(used, emptyAssetsDocument('2026-11-04T09:00:00.000Z'), ASSETS)
  await store.write('Added', (unit) => {
    unit.of(ASSET_WRITES).add(FLAT)
    unit.of(VALUATION_WRITES).add(APPRAISAL)
    unit.of(VALUATION_WRITES).add(GUESS)
  })
  return store
}

describe('Assets writes', () => {
  it('keeps an asset with its text trimmed and its valuations', async () => {
    const store = await storeWithFlat()

    expect(store.state.workbook!.assets).toMatchObject([{ asset: { name: 'Flat in Zagreb' }, valuations: [{ note: "The bank's appraisal" }, { date: '2026-06-01' }] }])
    expect(store.state.workbook!.problems).toEqual([])
  })

  it('refuses to delete an asset its valuations name, and deletes it with them in one write, which one Undo puts back', async () => {
    const store = await storeWithFlat()
    const before = store.state.workbook!.assets

    await expect(store.write('Deleted', (unit) => unit.of(ASSET_WRITES).remove(FLAT))).rejects.toThrow('The valuation "2026-01-10, 230000" would then be left out: names no asset in the file.')

    const receipt = await store.write('Deleted', (unit) => removeAsset(unit, store.state.records!, FLAT))
    expect(recordsChangeInWords(receipt!, null)).toBe('Deleted the asset "Flat in Zagreb" and deleted 2 valuations')
    expect(store.state.workbook!.assets).toEqual([])
    expect(store.state.workbook!.problems).toEqual([])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.assets).toEqual(before)
  })

  it('refuses a valuation of an asset that is gone, one before the asset was bought, and a change of the asset that leaves one before it', async () => {
    const store = await storeWithFlat()
    await store.write('Deleted', (unit) => removeAsset(unit, store.state.records!, FLAT))

    await expect(store.write('Added', (unit) => unit.of(VALUATION_WRITES).add(APPRAISAL))).rejects.toThrow('names no asset in the file')

    await store.undo(store.state.writes[0]!)
    await expect(store.write('Added', (unit) => unit.of(VALUATION_WRITES).add(newValuation({ asset: FLAT.id, date: civil('2025-01-01'), value: euros(1), note: '' })))).rejects.toThrow(
      'date 2025-01-01 is before "Flat in Zagreb" was bought on 2025-03-15',
    )
    await expect(store.write('Changed', (unit) => unit.of(ASSET_WRITES).change(FLAT, { ...FLAT, bought: civil('2026-03-01') }))).rejects.toThrow(
      'The valuation "2026-01-10, 230000" would then be left out: date 2026-01-10 is before "Flat in Zagreb" was bought on 2026-03-01.',
    )
  })

  it('refuses a second asset on a loan another asset names, and lets the first keep it', async () => {
    const store = await storeWithFlat()
    const homeLoan = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
    await store.write('Changed', (unit) => unit.of(ASSET_WRITES).change(FLAT, { ...FLAT, loan: homeLoan }))
    const garage = newAsset({ name: 'Garage', kind: 'other', bought: civil('2025-03-15'), price: euros(20_000), region: null, firstRegistration: null, loan: homeLoan, note: '' })

    await expect(store.write('Added', (unit) => unit.of(ASSET_WRITES).add(garage))).rejects.toThrow('names the same bank loan as another asset')
    expect(store.state.workbook!.assets.map((entry) => [entry.asset.name, entry.asset.loan, entry.loanShared])).toEqual([['Flat in Zagreb', homeLoan, false]])
  })
})
