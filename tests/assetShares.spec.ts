import { describe, expect, it } from 'vitest'

import type { HouseIndex } from '../src/apps/assets/houseIndex/domain/houseIndex'
import type { AssetLoan } from '../src/apps/assets/loans/application/assetLoans'
import { assetsOnDay, assetsTotal } from '../src/apps/assets/values/domain/assetsOnDay'
import { equityOf } from '../src/apps/assets/values/domain/equity'
import { codecOfAssetsKind } from '../src/apps/assets/workbook/application/assetsCodecs'
import { ASSET_RECORDS, ASSET_SHARE_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { ASSETS_APP, ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import { percentFromBasisPoints } from '../src/shared/money/percent'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { civil, euros } from './fixtures/ledger'

const FLAT_UUID = '3e9c6f4b-8a5d-4b12-ad04-6f7a8b9cadb3'
const LOAN_UUID = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
const FLAT = { id: FLAT_UUID, name: 'Flat in Zagreb', kind: 'other', bought: '2020-05-04', price: '240000.00', loan: LOAN_UUID }
const NO_INDEX: HouseIndex = { zagreb: new Map(), adriatic: new Map(), rest: new Map() }

type Records = Partial<Record<'asset' | 'asset-share', readonly DocumentRecord[]>>

function booksOf(records: Records) {
  const document = newDocument(ASSETS_APP, { assets: 2 }, records, '2026-11-04T09:00:00.000Z')
  return ASSETS_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-assets.json', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfAssetsKind(kind)
  return codec.fieldsOf(codec.make(storedFieldsOfValues(fields), recordIdOf(kind, String(fields.id))))
}

function homeLoan(owed: number): AssetLoan {
  return { key: LOAN_UUID, name: 'Home loan', owed: euros(owed), to: { path: '/loans/bank-loan', query: { loan: LOAN_UUID } } }
}

describe('your part of an asset you own with others', () => {
  it('reads a part as a percent with no sign, so 0.8 is 0.8% and not 80%', () => {
    const shareOf = (share: string) => booksOf({ asset: [{ ...FLAT, share }] }).assets[0]?.asset.share
    expect(shareOf('50')).toBe(percentFromBasisPoints(5000))
    expect(shareOf('33.33')).toBe(percentFromBasisPoints(3333))
    expect(shareOf('0.8')).toBe(percentFromBasisPoints(80))
    expect(shareOf('100')).toBe(percentFromBasisPoints(10_000))
  })

  it('refuses a part of zero, above 100, finer than two decimals or not a number, and says why', () => {
    const refused = ['0', '100.01', '33.333', 'half', '-5'].map((share) => booksOf({ asset: [{ ...FLAT, share }] }).problems.map((problem) => problem.reason))
    expect(refused).toEqual([
      ['share "0" is not a part above 0 and at most 100, with two decimals at most, such as 50 or 33.33'],
      ['share "100.01" is not a part above 0 and at most 100, with two decimals at most, such as 50 or 33.33'],
      ['share "33.333" is not a part above 0 and at most 100, with two decimals at most, such as 50 or 33.33'],
      ['share "half" is not a part above 0 and at most 100, with two decimals at most, such as 50 or 33.33'],
      ['share "-5" is not a part above 0 and at most 100, with two decimals at most, such as 50 or 33.33'],
    ])
  })

  it('writes an asset with its part and a share change back field for field, and leaves the part out of an asset that is all yours', () => {
    expect(roundTrip(ASSET_RECORDS, { ...FLAT, share: '33.33' })).toEqual({ ...FLAT, share: '33.33' })
    expect(roundTrip(ASSET_RECORDS, FLAT)).toEqual(FLAT)
    expect(booksOf({ asset: [FLAT] }).assets[0]?.asset).not.toHaveProperty('share')
    const change = { id: 's1', asset: FLAT_UUID, from: '2026-03-01', share: '100', note: 'Bought out my brother' }
    expect(roundTrip(ASSET_SHARE_RECORDS, change)).toEqual(change)
  })

  it('gives an asset its share changes oldest first, and doubts one before the day it was bought, a second on one day or one naming no asset', () => {
    const books = booksOf({
      asset: [{ ...FLAT, share: '50' }],
      'asset-share': [
        { id: 's2', asset: FLAT_UUID, from: '2026-03-01', share: '100' },
        { id: 's1', asset: FLAT_UUID, from: '2024-01-01', share: '75' },
        { id: 's3', asset: FLAT_UUID, from: '2019-01-01', share: '25' },
        { id: 's4', asset: 'b8a4d2f3-6e3b-4f90-8b82-4d5e6f7a8b92', from: '2024-01-01', share: '25' },
        { id: 's5', asset: FLAT_UUID, from: '2025-06-01', share: '60' },
        { id: 's6', asset: FLAT_UUID, from: '2025-06-01', share: '70' },
      ],
    })

    expect(books.assets[0]?.shares.map((change) => change.from)).toEqual(['2024-01-01', '2026-03-01'])
    expect(books.problems.map((problem) => [problem.kind, problem.label, problem.reason])).toEqual([
      ['asset-share', '2019-01-01, 25', 'from 2019-01-01 is before "Flat in Zagreb" was bought on 2020-05-04'],
      ['asset-share', '2024-01-01, 25', 'names no asset in the file'],
      ['asset-share', '2025-06-01, 60', 'another share change of "Flat in Zagreb" is from 2025-06-01 too'],
      ['asset-share', '2025-06-01, 70', 'another share change of "Flat in Zagreb" is from 2025-06-01 too'],
    ])
  })

  it('counts a third of a flat worth 240,000.00 as 79,992.00 and takes the whole loan on it off that part', () => {
    // 240,000.00 × 33.33% = 79,992.00, less the 75,000.00 owed.
    expect(equityOf(euros(240_000), percentFromBasisPoints(3333), homeLoan(75_000))).toEqual({
      value: euros(79_992),
      whole: euros(240_000),
      owed: euros(75_000),
      yours: euros(4_992),
    })
  })

  it('counts a flat bought at a half at its half before the buyout on 1 March 2026 and whole from that day', () => {
    const book = booksOf({ asset: [{ ...FLAT, share: '50' }], 'asset-share': [{ id: 's1', asset: FLAT_UUID, from: '2026-03-01', share: '100' }] })
    const onDay = (day: string) => assetsOnDay(book, civil(day), NO_INDEX, [homeLoan(100_000)])[0]!

    expect(onDay('2026-02-28')).toMatchObject({ share: percentFromBasisPoints(5000), equity: { value: euros(120_000), whole: euros(240_000), yours: euros(20_000) } })
    expect(onDay('2026-03-01').share).toBeNull()
    expect(onDay('2026-03-01').equity).toEqual({ value: euros(240_000), owed: euros(100_000), yours: euros(140_000) })
    expect(assetsTotal(book, civil('2026-02-28'), NO_INDEX, [homeLoan(100_000)])).toMatchObject({ value: euros(120_000) })
  })

  it('counts a flat owned alone until a partner bought half of it at the half from that day', () => {
    const book = booksOf({ asset: [FLAT], 'asset-share': [{ id: 's1', asset: FLAT_UUID, from: '2025-01-01', share: '50' }] })
    expect(assetsOnDay(book, civil('2024-12-31'), NO_INDEX, null)[0]!.equity.value).toBe(euros(240_000))
    expect(assetsOnDay(book, civil('2025-01-01'), NO_INDEX, null)[0]!.equity.value).toBe(euros(120_000))
  })
})
