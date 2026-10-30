import { describe, expect, it } from 'vitest'

import { currencyCodeOf } from '../src/shared/money/currencyCode'

describe('currencyCodeOf', () => {
  it('reads an ISO 4217 code, in capitals', () => {
    expect(currencyCodeOf('USD')).toBe('USD')
    expect(currencyCodeOf(' chf ')).toBe('CHF')
  })

  it('refuses what Intl does not format as a currency', () => {
    for (const text of ['', 'US', 'USDT', 'BTC', 'ABC']) {
      expect(currencyCodeOf(text)).toBeNull()
    }
  })

  it('refuses the precious metals, which are holdings and never cash', () => {
    for (const text of ['XAU', 'XAG', 'XPT', 'XPD']) {
      expect(currencyCodeOf(text)).toBeNull()
    }
  })
})
