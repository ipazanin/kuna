// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { browserFetch, browserPause } from '../src/apps/investments/prices/infrastructure/browserPricePorts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
