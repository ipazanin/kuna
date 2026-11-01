import { describe, expect, it, vi } from 'vitest'

import { countryName } from '../src/shared/text/countryName'

describe('countryName', () => {
  it('names a country from its ISO 3166 code, in any case', () => {
    expect(countryName('IE')).toBe('Ireland')
    expect(countryName(' us ')).toBe('United States')
  })

  it('gives back a code Intl does not know as a country, such as an international ISIN prefix', () => {
    expect(countryName('XS')).toBe('XS')
    expect(countryName('World')).toBe('World')
    expect(countryName('')).toBe('')
  })

  it('names the country in Croatian when Croatian is on screen', async () => {
    vi.resetModules()
    vi.doMock('../src/shared/text/language', () => ({ intlLocale: 'hr-HR' }))
    const { countryName: croatianName } = await import('../src/shared/text/countryName')
    expect(croatianName('DE')).toBe('Njemačka')
    vi.doUnmock('../src/shared/text/language')
  })
})
