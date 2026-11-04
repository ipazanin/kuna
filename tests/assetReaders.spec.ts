import { describe, expect, it } from 'vitest'

import { codecOfAssetsKind } from '../src/apps/assets/workbook/application/assetsCodecs'
import { ASSET_RECORDS, VALUATION_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { ASSETS_APP, ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { euros } from './fixtures/ledger'

const FLAT_UUID = '3e9c6f4b-8a5d-4b12-ad04-6f7a8b9cadb3'
const LOAN_UUID = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
const FLAT = { id: FLAT_UUID, name: 'Flat in Zagreb', kind: 'home', bought: '2025-03-15', price: '200000.00', region: 'zagreb', loan: LOAN_UUID }
const CAR = { id: 'c1', name: 'Family car', kind: 'car', bought: '2024-01-15', price: '30000.00', first_registration: '2024-01-15' }

type Records = Partial<Record<'asset' | 'valuation', readonly DocumentRecord[]>>

function booksOf(records: Records) {
  const document = newDocument(ASSETS_APP, { assets: 1 }, records, '2026-11-04T09:00:00.000Z')
  return ASSETS_DOCUMENT.read({
    meta: { id: 'local', source: 'browser', title: 'kuna-assets.json', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document,
  }).workbook
}

/** Each problem as its kind, the record's label and the reason. */
function problemsOf(records: Records): [string, string, string][] {
  return booksOf(records).problems.map((problem) => [problem.kind, problem.label, problem.reason])
}

function roundTrip<R>(kind: RecordKind<R>, fields: RecordFields): RecordFields {
  const codec = codecOfAssetsKind(kind)
  return codec.fieldsOf(codec.make(storedFieldsOfValues(fields), recordIdOf(kind, String(fields.id))))
}

describe('the Assets file', () => {
  it('writes both kinds back field for field as it read them', () => {
    const kinds: [RecordKind<unknown>, RecordFields][] = [
      [ASSET_RECORDS, { ...FLAT, note: 'Top floor' }],
      [ASSET_RECORDS, CAR],
      [ASSET_RECORDS, { id: 'p1', name: 'Plot', kind: 'other' }],
      [VALUATION_RECORDS, { id: 'v1', asset: FLAT_UUID, date: '2026-01-10', value: '230000.00', note: "The bank's appraisal" }],
      [VALUATION_RECORDS, { id: 'v2', asset: FLAT_UUID, date: '2026-02-10', value: '0.00' }],
    ]

    for (const [kind, fields] of kinds) {
      expect(roundTrip(kind, fields)).toEqual(fields)
    }
  })

  it('reads an asset with its valuations, oldest first, and the bare UUID of its loan', () => {
    const books = booksOf({
      asset: [FLAT],
      valuation: [
        { id: 'v2', asset: FLAT_UUID, date: '2026-06-01', value: '235000.00' },
        { id: 'v1', asset: FLAT_UUID, date: '2026-01-10', value: '230000.00' },
      ],
    })

    expect(books.problems).toEqual([])
    expect(books.assets).toMatchObject([
      {
        asset: { id: recordIdOf(ASSET_RECORDS, FLAT_UUID), kind: 'home', price: euros(200_000), region: 'zagreb', firstRegistration: null, loan: LOAN_UUID },
        valuations: [{ date: '2026-01-10', value: euros(230_000) }, { date: '2026-06-01' }],
      },
    ])
  })

  it('refuses an asset without a name, a kind, a price above zero paid on a day, or with a field of another kind, and says why', () => {
    expect(
      problemsOf({
        asset: [
          { ...FLAT, id: 'a1', name: '' },
          { ...FLAT, id: 'a2', name: 'Shed', kind: 'shed' },
          { ...FLAT, id: 'a3', name: 'Free flat', price: '0' },
          { ...FLAT, id: 'a4', name: 'Undated flat', bought: '' },
          { ...CAR, id: 'a5', name: 'Car in Zagreb', region: 'zagreb' },
          { ...FLAT, id: 'a6', name: 'Registered flat', first_registration: '2025-03-15' },
          { ...FLAT, id: 'a7', name: 'Lunar flat', region: 'moon' },
        ],
      }),
    ).toEqual([
      ['asset', 'unnamed', 'no name'],
      ['asset', 'Shed', '"shed" is not a kind of asset. Use home, car, other'],
      ['asset', 'Free flat', 'price must be more than zero'],
      ['asset', 'Undated flat', 'price is filled without bought, the day it was paid'],
      ['asset', 'Car in Zagreb', 'region is for a flat or house only'],
      ['asset', 'Registered flat', 'first_registration is for a car only'],
      ['asset', 'Lunar flat', '"moon" is not a region. Use zagreb, adriatic, rest'],
    ])
  })

  it('leaves out a valuation that names no asset, is below zero, comes before the asset was bought or shares its day with another', () => {
    expect(
      problemsOf({
        asset: [FLAT],
        valuation: [
          { id: 'v1', asset: 'not-an-asset', date: '2026-01-10', value: '230000.00' },
          { id: 'v2', asset: FLAT_UUID, date: '2026-01-10', value: '-1.00' },
          { id: 'v3', asset: FLAT_UUID, date: '2025-03-14', value: '199000.00' },
          { id: 'v4', asset: FLAT_UUID, date: '2026-06-01', value: '235000.00' },
          { id: 'v5', asset: FLAT_UUID, date: '2026-06-01', value: '236000.00' },
        ],
      }),
    ).toEqual([
      ['valuation', '2026-01-10, -1', 'value is below zero'],
      ['valuation', '2026-01-10, 230000', 'names no asset in the file'],
      ['valuation', '2025-03-14, 199000', 'date 2025-03-14 is before "Flat in Zagreb" was bought on 2025-03-15'],
      ['valuation', '2026-06-01, 235000', 'another valuation of "Flat in Zagreb" is on 2026-06-01 too'],
      ['valuation', '2026-06-01, 236000', 'another valuation of "Flat in Zagreb" is on 2026-06-01 too'],
    ])
  })

  it('reads a loan only as a bare UUID', () => {
    expect(problemsOf({ asset: [{ ...FLAT, loan: 'Home loan' }] })).toEqual([['asset', 'Flat in Zagreb', 'loan "Home loan" is not the bare UUID of a bank loan']])
  })

  it('counts two assets that name the same loan but doubts both, since a loan goes on one asset', () => {
    const books = booksOf({ asset: [FLAT, { ...CAR, loan: LOAN_UUID }] })

    expect(books.assets.map((entry) => [entry.asset.name, entry.loanShared])).toEqual([
      ['Flat in Zagreb', true],
      ['Family car', true],
    ])
    expect(books.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['Flat in Zagreb', 'names the same bank loan as another asset, so neither shows what is yours after it. A loan goes on one asset'],
      ['Family car', 'names the same bank loan as another asset, so neither shows what is yours after it. A loan goes on one asset'],
    ])
  })
})
