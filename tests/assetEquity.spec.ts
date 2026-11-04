import { describe, expect, it } from 'vitest'

import type { HouseIndex } from '../src/apps/assets/houseIndex/domain/houseIndex'
import type { AssetLoan } from '../src/apps/assets/loans/application/assetLoans'
import { equityOf } from '../src/apps/assets/values/domain/equity'
import { assetsOnDay, assetsTotal } from '../src/apps/assets/values/presentation/assetsOnDay'
import type { LoansOnScreen } from '../src/apps/assets/values/presentation/assetsOnDay'
import type { Asset } from '../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { ASSETS_APP, ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
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
  loan: HOME_LOAN_UUID,
  note: '',
}

function homeLoan(owed: number | null): AssetLoan {
  return { key: HOME_LOAN_UUID, name: 'Home loan', owed: owed === null ? null : euros(owed), to: { path: '/loans/bank-loan', query: { loan: HOME_LOAN_UUID } } }
}

function flatWith(loans: LoansOnScreen) {
  const [shown] = assetsOnDay({ assets: [{ asset: FLAT, valuations: [], loanShared: false }] }, DAY, INDEX, loans)
  return { link: shown!.link.kind, equity: shown!.equity }
}

describe('what is yours after the loan on an asset', () => {
  it('leaves a flat worth 238,884.80 at 88,884.80 yours after the 150,000.00 owed on the Home loan', () => {
    // 238,884.80 − 150,000.00.
    expect(equityOf(euros(238_884.8), homeLoan(150_000))).toEqual({ value: euros(238_884.8), owed: euros(150_000), yours: euros(88_884.8) })
    expect(flatWith([homeLoan(150_000)])).toEqual({ link: 'linked', equity: { value: euros(238_884.8), owed: euros(150_000), yours: euros(88_884.8) } })
  })

  it('makes all of the value yours once the loan is paid off', () => {
    expect(flatWith([homeLoan(0)]).equity).toEqual({ value: euros(238_884.8), owed: euros(0), yours: euros(238_884.8) })
  })

  it('shows neither what is owed nor what is yours for a loan whose plan Loans cannot work out', () => {
    expect(flatWith([homeLoan(null)])).toEqual({ link: 'linked', equity: { value: euros(238_884.8), owed: null, yours: null } })
  })

  it('says the loan is gone once Loans no longer lists it, and still counts the value', () => {
    expect(flatWith([])).toEqual({ link: 'gone', equity: { value: euros(238_884.8), owed: null, yours: null } })
  })

  it('shows no loan while Loans is not set up, and waits or fails with Loans', () => {
    expect(flatWith(null).link).toBe('none')
    expect(flatWith('opening')).toEqual({ link: 'opening', equity: { value: euros(238_884.8), owed: null, yours: null } })
    expect(flatWith('failed').link).toBe('failed')
  })

  it('shows no loan for an asset that names none', () => {
    const [shown] = assetsOnDay({ assets: [{ asset: { ...FLAT, loan: null }, valuations: [], loanShared: false }] }, DAY, INDEX, [homeLoan(150_000)])
    expect(shown!.link).toEqual({ kind: 'none' })
  })

  it('counts both values but subtracts no loan when a flat and a garage name the same loan, which the file is read with as a problem', () => {
    const records = {
      asset: [
        { id: 'a7f3c1e2-5d2a-4e8f-9a71-3c4d5e6f7a81', name: 'Flat in Zagreb', kind: 'home', bought: '2025-03-15', price: '200000.00', region: 'zagreb', loan: HOME_LOAN_UUID },
        { id: 'b8a4d2f3-6e3b-4f90-8b82-4d5e6f7a8b92', name: 'Garage', kind: 'other', bought: '2025-03-15', price: '20000.00', loan: HOME_LOAN_UUID },
      ],
    }
    const meta = { id: 'local', source: 'browser', title: 'kuna-assets.json', syncedAt: '2026-11-04T09:00:00.000Z', lastExportedAt: null, unexportedSince: null } as const
    const book = ASSETS_DOCUMENT.read({ meta, revision: '1', document: newDocument(ASSETS_APP, { assets: 1 }, records, meta.syncedAt) }).workbook

    expect(book.problems.map((problem) => problem.label)).toEqual(['Flat in Zagreb', 'Garage'])
    expect(assetsOnDay(book, DAY, INDEX, [homeLoan(150_000)]).map((shown) => [shown.link.kind, shown.equity.yours])).toEqual([
      ['shared', null],
      ['shared', null],
    ])
    // 238,884.80 for the flat and 20,000.00 for the garage, with the loan taken off once by Loans and never here.
    expect(assetsTotal(book, DAY, INDEX, [homeLoan(150_000)])).toEqual({ value: euros(258_884.8), yoursAfter: [], unvalued: 0, indexFailed: false })
  })
})
