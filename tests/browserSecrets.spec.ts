// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BEFORE_ANY_CHANGE } from '../src/shared/secrets/domain/secretsFile'
import { keepSecretChanges, moveBrowserSecrets, storeSecret, storedSecret, storedSecretChanges } from '../src/shared/secrets/infrastructure/browserSecrets'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const AT = '2026-10-30T10:00:00.000Z'

function denyStorage(): void {
  for (const method of ['getItem', 'setItem', 'removeItem', 'key'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
  }
}

describe('the secrets kept in this browser', () => {
  it('keeps each secret under a key of its own, trimmed, with the time it was saved', () => {
    storeSecret('twelvedata', '  made-up-key  ', AT)
    storeSecret('anthropic', 'other-made-up-key', AT)

    expect(storedSecret('twelvedata')).toBe('made-up-key')
    expect(storedSecret('anthropic')).toBe('other-made-up-key')
    expect(Object.keys(localStorage).sort()).toEqual(['kuna.secret-changed.anthropic', 'kuna.secret-changed.twelvedata', 'kuna.secret.anthropic', 'kuna.secret.twelvedata'])
    expect(storedSecretChanges()).toEqual({
      anthropic: { key: 'other-made-up-key', changedAt: AT },
      twelvedata: { key: 'made-up-key', changedAt: AT },
    })
  })

  it('forgets a key on an empty one or null, and keeps the time of the removal', () => {
    storeSecret('twelvedata', 'made-up-key', AT)
    storeSecret('twelvedata', '   ', '2026-10-30T10:05:00.000Z')
    expect(storedSecret('twelvedata')).toBeNull()

    storeSecret('alphavantage', 'made-up-key', AT)
    storeSecret('alphavantage', null, '2026-10-30T10:06:00.000Z')
    expect(Object.keys(localStorage).sort()).toEqual(['kuna.secret-changed.alphavantage', 'kuna.secret-changed.twelvedata'])
    expect(storedSecretChanges()).toEqual({
      alphavantage: { key: null, changedAt: '2026-10-30T10:06:00.000Z' },
      twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' },
    })
  })

  it('reads a key kept without a time, or with one the file does not take, as older than any change', () => {
    localStorage.setItem('kuna.secret.twelvedata', 'made-up-key')
    localStorage.setItem('kuna.secret.finnhub', 'other-made-up-key')
    localStorage.setItem('kuna.secret-changed.finnhub', '30.10.2026.')
    expect(storedSecretChanges()).toEqual({
      finnhub: { key: 'other-made-up-key', changedAt: BEFORE_ANY_CHANGE },
      twelvedata: { key: 'made-up-key', changedAt: BEFORE_ANY_CHANGE },
    })
  })

  it('leaves the request counts of the price vendors out, which are not secrets', () => {
    localStorage.setItem('kuna.price-vendor-usage.twelvedata', '{"day":"2026-10-30","count":3}')
    expect(storedSecretChanges()).toEqual({})
  })

  it('keeps every change a sync brings, an id this Kuna does not name among them', () => {
    keepSecretChanges({ newvendor: { key: 'made-up-new-key', changedAt: AT }, finnhub: { key: null, changedAt: AT } })
    expect(storedSecretChanges()).toEqual({ finnhub: { key: null, changedAt: AT }, newvendor: { key: 'made-up-new-key', changedAt: AT } })
  })

  it('has no key, and keeps none, where the browser denies storage', () => {
    denyStorage()

    expect(() => storeSecret('twelvedata', 'made-up-key', AT)).not.toThrow()
    expect(storedSecret('twelvedata')).toBeNull()
    expect(storedSecretChanges()).toEqual({})
  })
})

describe('the move of the price vendor keys this browser kept under their old names', () => {
  it('moves each old pair with its time and removes it, leaving the request counts', () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-twelve-data-key-0042')
    localStorage.setItem('kuna.price-vendor-key-changed.twelvedata', AT)
    localStorage.setItem('kuna.price-vendor-key-changed.finnhub', '2026-10-30T10:05:00.000Z')
    localStorage.setItem('kuna.price-vendor-key.alphavantage', 'MADEUPKEY01')
    localStorage.setItem('kuna.price-vendor-usage.twelvedata', '{"day":"2026-10-30","count":3}')

    moveBrowserSecrets()

    expect(storedSecretChanges()).toEqual({
      alphavantage: { key: 'MADEUPKEY01', changedAt: BEFORE_ANY_CHANGE },
      finnhub: { key: null, changedAt: '2026-10-30T10:05:00.000Z' },
      twelvedata: { key: 'made-up-twelve-data-key-0042', changedAt: AT },
    })
    expect(Object.keys(localStorage).filter((key) => key.startsWith('kuna.price-vendor-key'))).toEqual([])
    expect(localStorage.getItem('kuna.price-vendor-usage.twelvedata')).toBe('{"day":"2026-10-30","count":3}')
  })

  it('keeps a newer change under the new name, and still removes the old pair', () => {
    storeSecret('twelvedata', 'made-up-newer-key-1111', '2026-10-30T11:00:00.000Z')
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-older-key-0000')
    localStorage.setItem('kuna.price-vendor-key-changed.twelvedata', AT)

    moveBrowserSecrets()

    expect(storedSecretChanges()).toEqual({ twelvedata: { key: 'made-up-newer-key-1111', changedAt: '2026-10-30T11:00:00.000Z' } })
    expect(localStorage.getItem('kuna.price-vendor-key.twelvedata')).toBeNull()
    expect(localStorage.getItem('kuna.price-vendor-key-changed.twelvedata')).toBeNull()
  })

  it('lets an old change replace an older one under the new name', () => {
    storeSecret('twelvedata', 'made-up-older-key-0000', AT)
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-newer-key-1111')
    localStorage.setItem('kuna.price-vendor-key-changed.twelvedata', '2026-10-30T11:00:00.000Z')

    moveBrowserSecrets()

    expect(storedSecretChanges()).toEqual({ twelvedata: { key: 'made-up-newer-key-1111', changedAt: '2026-10-30T11:00:00.000Z' } })
  })

  it('does nothing a second time', () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-twelve-data-key-0042')
    moveBrowserSecrets()
    const once = { ...localStorage }
    moveBrowserSecrets()
    expect({ ...localStorage }).toEqual(once)
  })

  it('leaves everything as it is when storage is denied', () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-twelve-data-key-0042')
    denyStorage()
    expect(() => moveBrowserSecrets()).not.toThrow()
    vi.restoreAllMocks()
    expect(localStorage.getItem('kuna.price-vendor-key.twelvedata')).toBe('made-up-twelve-data-key-0042')
    expect(localStorage.getItem('kuna.secret.twelvedata')).toBeNull()
  })

  it('keeps the old pair when writing the new one fails, so the key moves on the next start', () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-twelve-data-key-0042')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    moveBrowserSecrets()
    vi.restoreAllMocks()
    expect(localStorage.getItem('kuna.price-vendor-key.twelvedata')).toBe('made-up-twelve-data-key-0042')

    moveBrowserSecrets()
    expect(storedSecret('twelvedata')).toBe('made-up-twelve-data-key-0042')
    expect(localStorage.getItem('kuna.price-vendor-key.twelvedata')).toBeNull()
  })
})
