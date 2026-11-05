import { describe, expect, it } from 'vitest'

import { entryCategoryChoices } from '../src/apps/spending/entries/presentation/categoryChoices'
import { CATEGORIES, category } from './fixtures/spending'

describe('the categories an entry can be filed under', () => {
  const boatHidden = CATEGORIES.map((held) => (held.id === category('Boat').id ? { ...held, hidden: true } : held))
  const labels = (own: string | null) => entryCategoryChoices(boatHidden, 'out', own === null ? null : category(own).id).flatMap((group) => group.map((choice) => choice.label))

  it('leaves out the children of a hidden group, as the limit picker does', () => {
    expect(labels(null)).not.toContain('Berth')
    expect(labels(null)).not.toContain('Boat')
  })

  it('keeps the entry’s own category under a hidden group', () => {
    expect(labels('Boat/Berth')).toEqual(expect.arrayContaining(['Boat', 'Berth']))
    expect(labels('Boat/Berth')).not.toContain('Service and gear')
  })

  const money = (side: 'out' | 'in', own: string | null, withTransfer = false) =>
    entryCategoryChoices(CATEGORIES, side, own === null ? null : category(own).id, withTransfer).flatMap((group) => group.map((choice) => choice.label))

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
})
