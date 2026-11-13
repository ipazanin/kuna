import { describe, expect, it } from 'vitest'

import { assetsHubFigures } from '../src/apps/assets/home/presentation/assetsHubFigures'
import type { HouseIndex } from '../src/apps/assets/houseIndex/domain/houseIndex'
import type { AssetLoan } from '../src/apps/assets/loans/application/assetLoans'
import type { Asset } from '../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import type { AssetWithValuations } from '../src/apps/assets/workbook/domain/readAssetBook'
import type { Valuation } from '../src/apps/assets/workbook/domain/valuation'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'

const DAY = civil('2026-11-04')
const HOME_LOAN_UUID = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
const INDEX: HouseIndex = {
  zagreb: new Map([
    ['2025Q1', 9505],
    ['2026Q2', 11353],
  ]),
  adriatic: new Map(),
  rest: new Map(),
}
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
const CAR: Asset = {
  id: recordIdOf(ASSET_RECORDS, 'car'),
  name: 'Car',
  kind: 'car',
  bought: civil('2024-01-15'),
  price: euros(30_000),
  region: null,
  firstRegistration: civil('2024-01-15'),
  loan: null,
  note: '',
}
const BOAT: Asset = {
  id: recordIdOf(ASSET_RECORDS, 'boat'),
  name: 'Boat',
  kind: 'other',
  bought: civil('2023-06-01'),
  price: euros(12_000),
  region: null,
  firstRegistration: null,
  loan: null,
  note: '',
}

const HOME_LOAN: AssetLoan = { key: HOME_LOAN_UUID, name: 'Home loan', owed: euros(150_000), to: { path: '/loans/bank-loan', query: { loan: HOME_LOAN_UUID } } }

function held(asset: Asset, valuations: readonly Valuation[] = []): AssetWithValuations {
  return { asset, valuations, loanShared: false }
}

function valuedOn(asset: Asset, date: string, value: number): Valuation {
  return { id: recordIdOf(ASSET_RECORDS, `${asset.name}-${date}`), asset: asset.id, date: civil(date), value: euros(value), note: '' }
}

function captionOf(assets: readonly AssetWithValuations[], index: HouseIndex | 'failed' = INDEX, loans: readonly AssetLoan[] | null = null): string | null {
  const figures = assetsHubFigures({ assets }, DAY, index, loans)
  if (figures === null || figures === 'opening') throw new Error('expected figures')
  return figures.parts[0]!.caption
}

describe('the caption under Assets value on Net worth', () => {
  it('says a flat the house price index carries is an estimate', () => {
    expect(captionOf([held(FLAT)])).toBe('Includes estimates')
  })

  it('says a car the customs table values is an estimate', () => {
    expect(captionOf([held(CAR)])).toBe('Includes estimates')
  })

  it('puts the estimate first and what is yours after the loan after it', () => {
    // The flat at 238,884.80 less 150,000.00 owed on the Home loan.
    expect(captionOf([held({ ...FLAT, loan: HOME_LOAN_UUID })], INDEX, [HOME_LOAN])).toBe('Includes estimates, €88,884.80 yours after the Home loan')
  })

  it('says nothing of estimates for a price paid or a valuation typed', () => {
    expect(captionOf([held(BOAT)])).toBeNull()
    expect(captionOf([held(CAR, [valuedOn(CAR, '2026-09-01', 21_000)])])).toBeNull()
  })

  it('says nothing of estimates while a failed index leaves a flat at its price', () => {
    expect(captionOf([held(FLAT)], 'failed')).toBeNull()
  })
})
