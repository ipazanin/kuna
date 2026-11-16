import { describe, expect, it } from 'vitest'

import { loanInterestCategoryIn, starterCategories } from '../src/apps/spending/categories/domain/starterCategories'

let next = 0
const newKey = (): string => `key-${++next}`

describe('the Loan interest an instalment link files interest under', () => {
  it('is the file’s own when it has one', () => {
    const categories = starterCategories('en', newKey)
    const held = categories.find((category) => category.name === 'Loan interest')!

    expect(loanInterestCategoryIn(categories, 'en', newKey)).toEqual({ category: held, added: [] })
  })

  it('is the file’s own by its role once it was renamed, so no second one is added', () => {
    const categories = starterCategories('en', newKey).map((category) => (category.role === 'loan-interest' ? { ...category, name: 'Mortgage interest' } : category))

    expect(loanInterestCategoryIn(categories, 'en', newKey)).toMatchObject({ category: { name: 'Mortgage interest', role: 'loan-interest' }, added: [] })
  })

  it('is a new one in the language beside the file’s Bank fees when the file has none, so the dialog can name it before the link adds it', () => {
    const categories = starterCategories('hr', newKey).filter((category) => category.name !== 'Kamate na kredit')
    const group = categories.find((category) => category.name === 'Novac i naknade')!

    const { category, added } = loanInterestCategoryIn(categories, 'hr', newKey)

    expect(category).toMatchObject({ name: 'Kamate na kredit', kind: 'spending', parent: group.id, role: 'loan-interest' })
    expect(added).toEqual([category])
  })

  it('is the file’s own when the file deleted its Bank fees, so no second Money and fees is added', () => {
    const categories = starterCategories('en', newKey).filter((category) => category.role !== 'bank-fees')
    const held = categories.find((category) => category.role === 'loan-interest')!

    expect(loanInterestCategoryIn(categories, 'en', newKey)).toEqual({ category: held, added: [] })
  })

  it('brings a new Money and fees with it when the file has neither Loan interest nor Bank fees', () => {
    const categories = starterCategories('en', newKey).filter((category) => category.role === null)

    const { category, added } = loanInterestCategoryIn(categories, 'en', newKey)

    expect(added.map((held) => held.name)).toEqual(['Money and fees', 'Loan interest'])
    expect(category.parent).toBe(added[0]!.id)
  })
})
