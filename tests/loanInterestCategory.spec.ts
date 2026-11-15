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

  it('is a new one in the language under the file’s Money and fees when the file has none, so the dialog can name it before the link adds it', () => {
    const categories = starterCategories('hr', newKey).filter((category) => category.name !== 'Kamate na kredit')
    const group = categories.find((category) => category.name === 'Novac i naknade')!

    const { category, added } = loanInterestCategoryIn(categories, 'hr', newKey)

    expect(category).toMatchObject({ name: 'Kamate na kredit', kind: 'spending', parent: group.id })
    expect(added).toEqual([category])
  })

  it('brings a new Money and fees with it when the file has neither', () => {
    const categories = starterCategories('en', newKey).filter((category) => category.name !== 'Money and fees' && category.name !== 'Loan interest')

    const { category, added } = loanInterestCategoryIn(categories, 'en', newKey)

    expect(added.map((held) => held.name)).toEqual(['Money and fees', 'Loan interest'])
    expect(category.parent).toBe(added[0]!.id)
  })
})
