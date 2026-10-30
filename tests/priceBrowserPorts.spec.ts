// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { browserFetch, browserPause } from '../src/apps/investments/prices/infrastructure/browserPricePorts'
import { storeVendorKey, storedVendorKey } from '../src/apps/investments/prices/infrastructure/vendorKeys'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the price vendor keys kept in this browser', () => {
  it('keeps each vendor key under a key of its own, trimmed', () => {
    storeVendorKey('twelvedata', '  made-up-key  ')
    storeVendorKey('alphavantage', 'other-made-up-key')

    expect(storedVendorKey('twelvedata')).toBe('made-up-key')
    expect(storedVendorKey('alphavantage')).toBe('other-made-up-key')
    expect(Object.keys(localStorage).sort()).toEqual(['kuna.price-vendor-key.alphavantage', 'kuna.price-vendor-key.twelvedata'])
  })

  it('forgets a key on an empty one or null', () => {
    storeVendorKey('twelvedata', 'made-up-key')
    storeVendorKey('twelvedata', '   ')
    expect(storedVendorKey('twelvedata')).toBeNull()

    storeVendorKey('alphavantage', 'made-up-key')
    storeVendorKey('alphavantage', null)
    expect(Object.keys(localStorage)).toEqual([])
  })

  it('has no key, and keeps none, where the browser denies storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(() => storeVendorKey('twelvedata', 'made-up-key')).not.toThrow()
    expect(storedVendorKey('twelvedata')).toBeNull()
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
