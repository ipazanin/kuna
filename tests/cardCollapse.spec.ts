// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { foldedCards, rememberCollapse, storedCollapse } from '../src/shared/ui/cardCollapse'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('remembered card state', () => {
  it('has no choice for a card nobody toggled', () => {
    expect(storedCollapse('billing.months')).toBeNull()
  })

  it('keeps each card apart, both ways', () => {
    rememberCollapse('billing.months', false)
    rememberCollapse('billing.rows', true)

    expect(storedCollapse('billing.months')).toBe(false)
    expect(storedCollapse('billing.rows')).toBe(true)
  })

  it('lists the cards kept folded, and none of what else this device keeps', () => {
    rememberCollapse('billing.rows', true)
    rememberCollapse('billing.months', false)
    rememberCollapse('assets.list', true)
    localStorage.setItem('kuna.theme', 'collapsed')

    expect(foldedCards()).toEqual(['assets.list', 'billing.rows'])
  })

  it('reads a damaged entry as no choice', () => {
    localStorage.setItem('kuna.card.billing.months', 'sideways')

    expect(storedCollapse('billing.months')).toBeNull()
  })

  it('works without storage, as in a private window that denies it', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => rememberCollapse('billing.months', true)).not.toThrow()
    expect(storedCollapse('billing.months')).toBeNull()
    expect(foldedCards()).toEqual([])
  })
})
