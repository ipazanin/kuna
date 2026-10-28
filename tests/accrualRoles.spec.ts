import { describe, expect, it } from 'vitest'

import { missingAccrualRoles } from '../src/apps/company/packs/hr-doo/presentation/accrualRoles'
import { STUDIO_CATEGORIES } from './fixtures/exampleStudio'

describe('missingAccrualRoles', () => {
  it('names nothing when every role the accrual view reads is carried', () => {
    expect(missingAccrualRoles(STUDIO_CATEGORIES)).toEqual([])
  })

  it('says when no category carries the personal transport or the non-deductible role, since their add-backs then stay at nothing', () => {
    const withoutAddBacks = STUDIO_CATEGORIES.map((category) => ({
      ...category,
      roles: category.roles.filter((role) => role !== 'personal-transport' && role !== 'non-deductible'),
    }))

    expect(missingAccrualRoles(withoutAddBacks).map((entry) => entry.role)).toEqual(['personal-transport', 'non-deductible'])
  })
})
