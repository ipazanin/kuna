import { describe, expect, it } from 'vitest'

import { resolveTheme, themeFromQuery } from '../src/shared/theme/theme'

describe('theme', () => {
  it('pins the theme from ?theme= and ignores anything else', () => {
    expect(themeFromQuery('?theme=light')).toBe('light')
    expect(themeFromQuery('?p=l12&theme=dark')).toBe('dark')
    expect(themeFromQuery('?theme=sepia')).toBeNull()
    expect(themeFromQuery('')).toBeNull()
  })

  it('lets a pin win over the system preference', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('follows the system preference without a pin, dark unless light is asked for', () => {
    expect(resolveTheme(null, false)).toBe('dark')
    expect(resolveTheme(null, true)).toBe('light')
  })
})
