import { describe, expect, it } from 'vitest'

import type { HouseIndex } from '../src/apps/assets/houseIndex/domain/houseIndex'
import { assetValueOn } from '../src/apps/assets/values/domain/assetValue'
import type { Asset } from '../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import type { Valuation } from '../src/apps/assets/workbook/domain/valuation'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'

const DAY = civil('2026-11-04')
const INDEX: HouseIndex = {
  zagreb: new Map([
    ['2025Q1', 9505],
    ['2026Q1', 10904],
    ['2026Q2', 11353],
  ]),
  adriatic: new Map(),
  rest: new Map(),
}

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: recordIdOf(ASSET_RECORDS, 'a'),
    name: 'Boat',
    kind: 'other',
    bought: civil('2022-06-01'),
    price: euros(18_000),
    region: null,
    firstRegistration: null,
    loan: null,
    note: '',
    ...overrides,
  }
}

function valuation(date: string, value: number): Valuation {
  return { id: recordIdOf(VALUATION_RECORDS, date), asset: recordIdOf(ASSET_RECORDS, 'a'), date: civil(date), value: euros(value), note: '' }
}

describe('what an asset is worth on a day', () => {
  it('takes the newest valuation on or before the day, and leaves out one after it', () => {
    expect(assetValueOn(asset({}), [valuation('2026-05-01', 15_500), valuation('2026-12-01', 15_000)], DAY, null)).toEqual({
      cents: euros(15_500),
      basis: { kind: 'valuation', date: '2026-05-01' },
    })
  })

  it('takes the price paid without a valuation, once the asset was bought', () => {
    expect(assetValueOn(asset({}), [], DAY, null)).toEqual({ cents: euros(18_000), basis: { kind: 'price', date: '2022-06-01' } })
    expect(assetValueOn(asset({ bought: civil('2026-12-01') }), [], DAY, null)).toBeNull()
  })

  it("carries a home's valuation by the index of its region, and keeps it while the index is not in hand", () => {
    const flat = asset({ kind: 'home', region: 'zagreb' })
    // 230,000.00 × 113.53 ÷ 109.04 = 239,470.84.
    expect(assetValueOn(flat, [valuation('2026-01-10', 230_000)], DAY, INDEX)).toMatchObject({ cents: euros(239_470.84), basis: { kind: 'house-index', quarter: '2026Q2' } })
    expect(assetValueOn(flat, [valuation('2026-01-10', 230_000)], DAY, null)).toEqual({ cents: euros(230_000), basis: { kind: 'valuation', date: '2026-01-10' } })
  })

  it('estimates a car by the customs table until a valuation is typed, which it keeps', () => {
    const car = asset({ kind: 'car', bought: civil('2024-01-15'), price: euros(30_000), firstRegistration: civil('2024-01-15') })

    expect(assetValueOn(car, [], DAY, INDEX)).toEqual({ cents: euros(17_370), basis: { kind: 'customs', onDay: { months: 33, share: 5790 }, whenBought: null } })
    expect(assetValueOn(car, [valuation('2026-09-01', 19_000)], DAY, INDEX)).toEqual({ cents: euros(19_000), basis: { kind: 'valuation', date: '2026-09-01' } })
    expect(assetValueOn({ ...car, firstRegistration: null }, [], DAY, INDEX)).toEqual({ cents: euros(30_000), basis: { kind: 'price', date: '2024-01-15' } })
  })

  it("keeps a home's price paid before the index starts, naming the index's first quarter", () => {
    const flat = asset({ kind: 'home', region: 'zagreb', bought: civil('1998-06-01'), price: euros(50_000) })

    expect(assetValueOn(flat, [], DAY, INDEX)).toEqual({ cents: euros(50_000), basis: { kind: 'index-not-reached', base: 'price', date: '1998-06-01', first: '2025Q1' } })
  })

  it("keeps a home's price paid in a quarter the index has not reached yet, and says it was the price", () => {
    const flat = asset({ kind: 'home', region: 'zagreb', bought: civil('2026-08-01'), price: euros(300_000) })

    expect(assetValueOn(flat, [], DAY, INDEX)).toEqual({ cents: euros(300_000), basis: { kind: 'index-not-out', base: 'price', date: '2026-08-01', quarter: '2026Q3' } })
  })

  it('gives no value to an asset with neither a price nor a valuation', () => {
    expect(assetValueOn(asset({ bought: null, price: null }), [], DAY, INDEX)).toBeNull()
  })
})
