import { describe, expect, it } from 'vitest'

import { entryCategoryChoices } from '../src/apps/spending/entries/presentation/categoryChoices'
import { CATEGORIES, category } from './fixtures/spending'

describe('the categories an entry can be filed under', () => {
  const childrenHidden = CATEGORIES.map((held) => (held.id === category('Children and education').id ? { ...held, hidden: true } : held))
  const labels = (own: string | null) => entryCategoryChoices(childrenHidden, 'out', own === null ? null : category(own).id).flatMap((group) => group.map((choice) => choice.label))

  it('leaves out the children of a hidden group, as the limit picker does', () => {
    expect(labels(null)).not.toContain('Kindergarten and school')
    expect(labels(null)).not.toContain('Children and education')
  })

  it('keeps the entry’s own category under a hidden group', () => {
    expect(labels('Children and education/Kindergarten and school')).toEqual(expect.arrayContaining(['Children and education', 'Kindergarten and school']))
    expect(labels('Children and education/Kindergarten and school')).not.toContain('Courses and books')
  })

  const money = (side: 'out' | 'in', own: string | null, withTransfer = false) =>
    entryCategoryChoices(CATEGORIES, side, own === null ? null : category(own).id, { withTransfer }).flatMap((group) => group.map((choice) => choice.label))

  it('offers money in the income categories and then the spending ones, where it is a refund, and money out no income', () => {
    expect(money('in', null)).toEqual(expect.arrayContaining(['Salary', 'Clothes and shoes', 'Saved to investments', 'For the company']))
    expect(money('in', null).indexOf('Salary')).toBeLessThan(money('in', null).indexOf('Clothes and shoes'))
    expect(money('out', null)).not.toContain('Salary')
  })

  it('offers Between my accounts only when asked, or to an entry that has it', () => {
    expect(money('out', null)).not.toContain('Between my accounts')
    expect(money('in', null, true)).toContain('Between my accounts')
    expect(money('out', 'Between my accounts')).toContain('Between my accounts')
  })

  it('offers a shared cost no fixed category, money in or out, so it always counts under spending or income', () => {
    const forSharedCost = (side: 'out' | 'in', own: string | null) =>
      entryCategoryChoices(CATEGORIES, side, own === null ? null : category(own).id, { withFixed: false }).flatMap((group) => group.map((choice) => choice.label))
    for (const side of ['out', 'in'] as const) {
      expect(forSharedCost(side, null)).not.toContain('For the company')
      expect(forSharedCost(side, null)).not.toContain('Saved to investments')
      expect(forSharedCost(side, null)).not.toContain('Between my accounts')
      expect(forSharedCost(side, null)).not.toContain('In a shared cost')
    }
    expect(forSharedCost('in', null)).toEqual(expect.arrayContaining(['Salary', 'Clothes and shoes']))
  })

  it('offers In a shared cost only to a part already in one, so a member keeps its category and no other part can join this way', () => {
    expect(money('out', null)).not.toContain('In a shared cost')
    expect(money('in', null, true)).not.toContain('In a shared cost')
    expect(money('out', 'In a shared cost')).toContain('In a shared cost')
    expect(money('in', 'In a shared cost')).toContain('In a shared cost')
  })
})
