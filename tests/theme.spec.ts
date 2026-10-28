// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { activeTheme, applyInitialTheme, chooseTheme, resolveTheme, themeChoice, themeChoiceFrom, themeFromQuery } from '../src/shared/theme/theme'

/** The device's colour scheme setting, which a test can change while the app runs. */
function fakeDevice(prefersLight: boolean): { change(prefersLight: boolean): void } {
  let matches = prefersLight
  const listeners: ((change: { matches: boolean }) => void)[] = []
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches
    },
    addEventListener: (_type: string, listener: (change: { matches: boolean }) => void) => listeners.push(listener),
  }))
  return {
    change(next) {
      matches = next
      listeners.forEach((listener) => listener({ matches: next }))
    },
  }
}

describe('theme', () => {
  it('pins the theme from ?theme= and ignores anything else', () => {
    expect(themeFromQuery('?theme=light')).toBe('light')
    expect(themeFromQuery('?p=l12&theme=dark')).toBe('dark')
    expect(themeFromQuery('?theme=sepia')).toBeNull()
    expect(themeFromQuery('')).toBeNull()
  })

  it('reads a stored Light or Dark as the choice, and anything else as System', () => {
    expect(themeChoiceFrom('light')).toBe('light')
    expect(themeChoiceFrom('dark')).toBe('dark')
    expect(themeChoiceFrom(null)).toBe('system')
    expect(themeChoiceFrom('sepia')).toBe('system')
  })

  it('lets a pin win over the choice and the device', () => {
    expect(resolveTheme('dark', 'light', true)).toBe('dark')
    expect(resolveTheme('light', 'system', false)).toBe('light')
  })

  it('lets Light or Dark win over the device', () => {
    expect(resolveTheme(null, 'dark', true)).toBe('dark')
    expect(resolveTheme(null, 'light', false)).toBe('light')
  })

  it('follows the device on System, dark unless it asks for light', () => {
    expect(resolveTheme(null, 'system', false)).toBe('dark')
    expect(resolveTheme(null, 'system', true)).toBe('light')
  })
})

describe('theme on this device', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = 'dark'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens on System, takes the device setting and follows it while the app runs', () => {
    const device = fakeDevice(true)

    expect(applyInitialTheme()).toBe('light')
    expect(themeChoice.value).toBe('system')

    device.change(false)
    expect(activeTheme.value).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('remembers Light or Dark and stops following the device', () => {
    const device = fakeDevice(false)
    applyInitialTheme()

    chooseTheme('light')
    device.change(false)

    expect(localStorage.getItem('kuna.theme')).toBe('light')
    expect(activeTheme.value).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
  })

  it('forgets the stored choice on System and takes the device setting again', () => {
    localStorage.setItem('kuna.theme', 'dark')
    const device = fakeDevice(true)
    expect(applyInitialTheme()).toBe('dark')

    chooseTheme('system')
    expect(localStorage.getItem('kuna.theme')).toBeNull()
    expect(activeTheme.value).toBe('light')

    device.change(false)
    expect(activeTheme.value).toBe('dark')
  })
})
