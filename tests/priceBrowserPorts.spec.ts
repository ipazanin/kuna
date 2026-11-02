// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { browserFetch, browserPause } from '../src/apps/investments/prices/infrastructure/browserPricePorts'
import { BEFORE_ANY_CHANGE } from '../src/apps/investments/prices/domain/keysFile'
import { storeVendorKey, storedKeyChanges, storedVendorKey } from '../src/apps/investments/prices/infrastructure/vendorKeys'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const AT = '2026-10-30T10:00:00.000Z'

describe('the price vendor keys kept in this browser', () => {
  it('keeps each vendor key under a key of its own, trimmed, with the time it was saved', () => {
    storeVendorKey('twelvedata', '  made-up-key  ', AT)
    storeVendorKey('alphavantage', 'other-made-up-key', AT)

    expect(storedVendorKey('twelvedata')).toBe('made-up-key')
    expect(storedVendorKey('alphavantage')).toBe('other-made-up-key')
    expect(Object.keys(localStorage).sort()).toEqual([
      'kuna.price-vendor-key-changed.alphavantage',
      'kuna.price-vendor-key-changed.twelvedata',
      'kuna.price-vendor-key.alphavantage',
      'kuna.price-vendor-key.twelvedata',
    ])
    expect(storedKeyChanges(['twelvedata', 'alphavantage', 'finnhub'])).toEqual({
      twelvedata: { key: 'made-up-key', changedAt: AT },
      alphavantage: { key: 'other-made-up-key', changedAt: AT },
    })
  })

  it('forgets a key on an empty one or null, and keeps the time of the removal', () => {
    storeVendorKey('twelvedata', 'made-up-key', AT)
    storeVendorKey('twelvedata', '   ', '2026-10-30T10:05:00.000Z')
    expect(storedVendorKey('twelvedata')).toBeNull()

    storeVendorKey('alphavantage', 'made-up-key', AT)
    storeVendorKey('alphavantage', null, '2026-10-30T10:06:00.000Z')
    expect(Object.keys(localStorage).sort()).toEqual(['kuna.price-vendor-key-changed.alphavantage', 'kuna.price-vendor-key-changed.twelvedata'])
    expect(storedKeyChanges(['twelvedata', 'alphavantage'])).toEqual({
      twelvedata: { key: null, changedAt: '2026-10-30T10:05:00.000Z' },
      alphavantage: { key: null, changedAt: '2026-10-30T10:06:00.000Z' },
    })
  })

  it('reads a key kept before keys carried a time as older than any change', () => {
    localStorage.setItem('kuna.price-vendor-key.twelvedata', 'made-up-key')
    expect(storedKeyChanges(['twelvedata'])).toEqual({ twelvedata: { key: 'made-up-key', changedAt: BEFORE_ANY_CHANGE } })
  })

  it('has no key, and keeps none, where the browser denies storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => storeVendorKey('twelvedata', 'made-up-key', AT)).not.toThrow()
    expect(storedVendorKey('twelvedata')).toBeNull()
    expect(storedKeyChanges(['twelvedata'])).toEqual({})
  })
})

describe('the browser ports of a price fetch', () => {
  it('asks with the address alone, so no header of its own makes the browser send a CORS preflight', async () => {
    const fetch = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }))
    vi.stubGlobal('fetch', fetch)

    expect(await browserFetch('https://api.twelvedata.com/time_series?symbol=ABC')).toEqual({ status: 200, text: '{"status":"ok"}' })
    expect(fetch.mock.calls).toEqual([['https://api.twelvedata.com/time_series?symbol=ABC']])
  })

  it('pauses for the time asked', async () => {
    vi.useFakeTimers()
    let done = false
    const paused = browserPause(61_000).then(() => {
      done = true
    })

    await vi.advanceTimersByTimeAsync(60_999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await paused
    expect(done).toBe(true)
  })
})
