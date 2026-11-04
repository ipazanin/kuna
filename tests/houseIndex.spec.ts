import { describe, expect, it } from 'vitest'

import { carriedForward, quarterOf } from '../src/apps/assets/houseIndex/domain/houseIndex'
import type { HouseIndex, Quarter } from '../src/apps/assets/houseIndex/domain/houseIndex'
import { houseIndexOfAnswer } from '../src/apps/assets/houseIndex/infrastructure/dzsHouseIndex'
import { FAKE_HOUSE_INDEX_ANSWER } from '../src/apps/assets/houseIndex/infrastructure/fake/fakeHouseIndex'
import { assetValueOn } from '../src/apps/assets/values/domain/assetValue'
import type { Asset } from '../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'

/** The DZS index for Grad Zagreb (2025 = 100) in 2025 Q1 and in 2026 Q2, its newest quarter on 4 Nov 2026. */
const ZAGREB = new Map<Quarter, number>([
  ['2025Q1', 9505],
  ['2026Q2', 11353],
])
const INDEX: HouseIndex = { zagreb: ZAGREB, adriatic: new Map(), rest: new Map() }
const DAY = civil('2026-11-04')

const FLAT: Asset = {
  id: recordIdOf(ASSET_RECORDS, 'flat'),
  name: 'Flat in Zagreb',
  kind: 'home',
  bought: civil('2025-03-15'),
  price: euros(200_000),
  region: 'zagreb',
  firstRegistration: null,
  loan: null,
  note: '',
}

describe('the house price index', () => {
  it('carries a Zagreb flat bought in March 2025 for 200,000.00 to 2026 Q2', () => {
    // 200,000.00 × 113.53 ÷ 95.05 = 238,884.797…, rounded half away from zero.
    expect(carriedForward(euros(200_000), civil('2025-03-15'), ZAGREB, DAY)).toEqual({ kind: 'carried', cents: euros(238_884.8), quarter: '2026Q2' })
    expect(assetValueOn(FLAT, [], DAY, INDEX)).toEqual({ cents: euros(238_884.8), basis: { kind: 'house-index', base: euros(200_000), date: '2025-03-15', quarter: '2026Q2', region: 'zagreb' } })
  })

  it('keeps a valuation newer than every quarter of the index, naming the quarter that is not out yet', () => {
    const valuation = { id: recordIdOf(VALUATION_RECORDS, 'v'), asset: FLAT.id, date: civil('2026-10-01'), value: euros(250_000), note: '' }

    expect(carriedForward(euros(250_000), civil('2026-10-01'), ZAGREB, DAY)).toEqual({ kind: 'not-out', quarter: '2026Q4' })
    expect(assetValueOn(FLAT, [valuation], DAY, INDEX)).toEqual({ cents: euros(250_000), basis: { kind: 'index-not-out', base: 'valuation', date: '2026-10-01', quarter: '2026Q4' } })
  })

  it('leaves a home without a region at its price, names the first quarter for a value older than the index, and carries nothing for a region it lacks', () => {
    expect(assetValueOn({ ...FLAT, region: null }, [], DAY, INDEX)).toEqual({ cents: euros(200_000), basis: { kind: 'price', date: '2025-03-15' } })
    expect(carriedForward(euros(200_000), civil('2001-06-01'), ZAGREB, DAY)).toEqual({ kind: 'not-reached', first: '2025Q1' })
    expect(carriedForward(euros(200_000), civil('2025-03-15'), new Map(), DAY)).toBeNull()
  })

  it('puts each day in its quarter, at both edges of every quarter', () => {
    const edges = ['2026-01-01', '2026-03-31', '2026-04-01', '2026-06-30', '2026-07-01', '2026-09-30', '2026-10-01', '2026-12-31']
    expect(edges.map((day) => quarterOf(civil(day)))).toEqual(['2026Q1', '2026Q1', '2026Q2', '2026Q2', '2026Q3', '2026Q3', '2026Q4', '2026Q4'])
  })

  it('reads a JSON-stat answer by its ids and sizes, whatever order the dimensions come in', () => {
    const answer = FAKE_HOUSE_INDEX_ANSWER
    const quarters = answer.size[2]!
    // The same cube with the quarters first and the regions last, so each value moves to a new place.
    const reordered = {
      ...answer,
      id: ['Tromjesečje', 'Indikatori', 'Kategorije'],
      size: [quarters, 1, 3],
      value: Array.from({ length: quarters * 3 }, (_, place) => answer.value[(place % 3) * quarters + Math.floor(place / 3)]!),
    }

    const read = houseIndexOfAnswer(reordered)

    expect(read).toEqual(houseIndexOfAnswer(answer))
    expect([read.zagreb.get('2025Q1'), read.zagreb.get('2026Q2'), read.adriatic.get('2026Q2'), read.rest.get('2026Q2')]).toEqual([9505, 11353, 10846, 11334])
    expect(() => houseIndexOfAnswer({ error: 'Too many requests' })).toThrow('The DZS answer is not the house price index table.')
    const { Tromjesečje: _quarters, ...withoutQuarters } = answer.dimension
    expect(() => houseIndexOfAnswer({ ...answer, id: ['Kategorije', 'Indikatori'], size: [3, 1], dimension: withoutQuarters, value: answer.value.slice(0, 3) })).toThrow(
      'The DZS answer is not the house price index table.',
    )
  })
})
