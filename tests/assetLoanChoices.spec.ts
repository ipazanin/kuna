import { describe, expect, it } from 'vitest'

import { loanChoices } from '../src/apps/assets/asset/presentation/loanChoices'
import type { AssetLoan } from '../src/apps/assets/loans/application/assetLoans'
import type { Asset } from '../src/apps/assets/workbook/domain/asset'
import { ASSET_RECORDS } from '../src/apps/assets/workbook/domain/assetKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

const HOME_LOAN = 'fa4e0000-0000-4000-8000-000000000001'
const CAR_LOAN = 'fa4e0000-0000-4000-8000-000000000030'
const LOANS: AssetLoan[] = [
  { key: HOME_LOAN, name: 'Home loan', owed: null, to: '/loans' },
  { key: CAR_LOAN, name: 'Car loan', owed: null, to: '/loans' },
]

function asset(key: string, loan: string | null): Asset {
  return { id: recordIdOf(ASSET_RECORDS, key), name: key, kind: 'other', bought: null, price: null, region: null, firstRegistration: null, loan, note: '' }
}

const FLAT = asset('flat', HOME_LOAN)
const CAR = asset('car', null)
const BOOK = { assets: [FLAT, CAR].map((owned) => ({ asset: owned, valuations: [], loanShared: false })) }

describe('the loans the asset dialog offers', () => {
  it('hides a loan another asset names, and offers the rest after No loan', () => {
    expect(loanChoices(LOANS, BOOK, CAR).map((choice) => choice.label)).toEqual(['No loan', 'Car loan'])
    expect(loanChoices(LOANS, BOOK, null).map((choice) => choice.label)).toEqual(['No loan', 'Car loan'])
  })

  it('keeps offering the loan the asset names when it edits itself', () => {
    expect(loanChoices(LOANS, BOOK, FLAT).map((choice) => choice.value)).toEqual(['none', HOME_LOAN, CAR_LOAN])
  })

  it('keeps the stored loan as not in Loans now while Loans does not list it, so a save keeps the link', () => {
    expect(loanChoices([LOANS[1]!], BOOK, FLAT)).toEqual([
      { label: 'No loan', value: 'none' },
      { label: 'Car loan', value: CAR_LOAN },
      { label: 'Not in Loans now', value: HOME_LOAN },
    ])
    expect(loanChoices('opening', BOOK, FLAT)).toEqual([
      { label: 'No loan', value: 'none' },
      { label: 'Not in Loans now', value: HOME_LOAN },
    ])
  })
})
