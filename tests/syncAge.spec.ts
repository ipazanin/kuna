import { describe, expect, it } from 'vitest'

import { syncAge } from '../src/shared/calendar/syncAge'

const now = new Date(2026, 9, 17, 14, 30)

describe('syncAge', () => {
  it('says how long ago in minutes and hours on the same day', () => {
    expect(syncAge(new Date(2026, 9, 17, 14, 29, 40), now)).toBe('just now')
    expect(syncAge(new Date(2026, 9, 17, 14, 25), now)).toBe('5 min ago')
    expect(syncAge(new Date(2026, 9, 17, 11, 0), now)).toBe('3 h ago')
  })

  it('names yesterday and gives the day before that', () => {
    expect(syncAge(new Date(2026, 9, 16, 22, 0), now)).toBe('yesterday')
    expect(syncAge(new Date(2026, 9, 12, 9, 0), now)).toBe('on 12 Oct')
  })
})
