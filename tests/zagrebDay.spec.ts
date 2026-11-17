import { afterEach, describe, expect, it, vi } from 'vitest'

import { zagrebDay } from '../src/apps/investments/prices/presentation/zagrebDay'

afterEach(() => {
  vi.useRealTimers()
})

describe('the Investments day', () => {
  it('turns at midnight in Zagreb, so a page left open past it values a new day', () => {
    vi.useFakeTimers()
    // 23:59 on Monday 16 November in Zagreb, an hour ahead of UTC.
    vi.setSystemTime(new Date('2026-11-16T22:59:00.000Z'))
    const day = zagrebDay()

    expect(day.value).toBe('2026-11-16')
    vi.advanceTimersByTime(30_000)
    expect(day.value).toBe('2026-11-16')
    vi.advanceTimersByTime(2 * 60_000)
    expect(day.value).toBe('2026-11-17')
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(day.value).toBe('2026-11-18')
  })
})
