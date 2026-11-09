// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

import { countRequest, requestsToday, setRequestsToday } from '../src/apps/investments/prices/infrastructure/vendorUsage'

const MORNING = new Date('2026-11-07T08:00:00Z')
const NEXT_DAY = new Date('2026-11-08T00:30:00Z')

afterEach(() => localStorage.clear())

describe("this browser's requests to a price vendor", () => {
  it('counts each request on its UTC day, from the count set for that day', () => {
    countRequest('twelvedata', MORNING)
    countRequest('twelvedata', MORNING)
    expect(requestsToday('twelvedata', MORNING)).toBe(2)

    setRequestsToday('twelvedata', MORNING, 0)
    countRequest('twelvedata', MORNING)
    expect(requestsToday('twelvedata', MORNING)).toBe(1)
    expect(requestsToday('finnhub', MORNING)).toBe(0)
  })

  it('starts afresh on a new UTC day', () => {
    setRequestsToday('twelvedata', MORNING, 40)
    expect(requestsToday('twelvedata', NEXT_DAY)).toBe(0)
    countRequest('twelvedata', NEXT_DAY)
    expect(requestsToday('twelvedata', NEXT_DAY)).toBe(1)
  })
})
