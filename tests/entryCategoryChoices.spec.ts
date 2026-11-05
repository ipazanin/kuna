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
})
