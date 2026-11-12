// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { deviceChoice, deviceText, jsonChoice, keptKeys } from '../src/shared/device/deviceChoice'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

const SIDEBAR = { read: (stored: string) => (stored === 'icons' ? 'icons' : null), write: (chosen: string) => chosen }

describe('a choice kept on this device', () => {
  it('reads the default until a choice is kept, and forgets the choice when the default is chosen again', () => {
    const sidebar = deviceChoice('kuna.planted', 'expanded', SIDEBAR)
    expect(sidebar.read()).toBe('expanded')

    expect(sidebar.remember('icons')).toBe(true)
    expect(localStorage.getItem('kuna.planted')).toBe('icons')
    expect(sidebar.read()).toBe('icons')

    sidebar.remember('expanded')
    expect(localStorage.getItem('kuna.planted')).toBeNull()
  })

  it('reads a value it does not take, or JSON that does not parse, as the default', () => {
    localStorage.setItem('kuna.planted', 'sideways')
    localStorage.setItem('kuna.planted-json', '{"day":')

    expect(deviceChoice('kuna.planted', 'expanded', SIDEBAR).read()).toBe('expanded')
    expect(jsonChoice('kuna.planted-json', (parsed) => parsed).read()).toBeNull()
  })

  it('reads the default and says a choice was not kept where a private window denies storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(deviceText('kuna.planted').read()).toBeNull()
    expect(deviceText('kuna.planted').remember('icons')).toBe(false)
  })

  it('lists the keys under a prefix and nothing else', () => {
    localStorage.setItem('kuna.card.a', 'collapsed')
    localStorage.setItem('kuna.card.b', 'expanded')
    localStorage.setItem('kuna.theme', 'dark')

    expect([...keptKeys('kuna.card.')].sort()).toEqual(['kuna.card.a', 'kuna.card.b'])
  })
})
