import { describe, expect, it } from 'vitest'

import { NO_REGION, typedAssetTerms } from '../src/apps/assets/asset/presentation/assetTexts'
import type { AssetTexts } from '../src/apps/assets/asset/presentation/assetTexts'
import { typedValuationTerms } from '../src/apps/assets/asset/presentation/valuationTexts'
import { civil } from './fixtures/ledger'

const car: AssetTexts = { name: 'Car', kind: 'car', bought: '2024-05-10', price: '20000', region: NO_REGION, firstRegistration: '2024-05-10' }

describe('typedAssetTerms', () => {
  it('reports a price that is not an amount', () => {
    const typed = typedAssetTerms({ ...car, price: 'lots' })
    expect(typed.errors.price).not.toBeNull()
    expect(typed.terms).toBeNull()
  })

  it('does not block a home on a first registration it hides', () => {
    const typed = typedAssetTerms({ ...car, kind: 'home', firstRegistration: 'not a day' })
    expect(typed.errors.firstRegistration).toBeNull()
    expect(typed.terms).not.toBeNull()
    expect(typed.terms!.firstRegistration).toBeNull()
  })

  it('needs the day it was bought for a price', () => {
    const typed = typedAssetTerms({ ...car, bought: '' })
    expect(typed.errors.price).not.toBeNull()
    expect(typed.terms).toBeNull()
  })
})

describe('typedValuationTerms', () => {
  const context = { bought: civil('2024-05-10'), valuations: [], editing: null }

  it('reports a value that is not an amount', () => {
    const typed = typedValuationTerms({ date: '2025-01-01', value: 'lots' }, context)
    expect(typed.errors.value).not.toBeNull()
    expect(typed.terms).toBeNull()
  })

  it('reports a day before the asset was bought', () => {
    expect(typedValuationTerms({ date: '2024-05-09', value: '100' }, context).errors.date).not.toBeNull()
  })
})
