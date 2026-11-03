import { describe, expect, it } from 'vitest'

import { inoDohDue, inoIzjavaDue, joppdDue, thirtyDaysDue, yearDueNext } from '../src/apps/investments/tax/domain/taxDeadlines'
import { civil } from './fixtures/ledger'

describe('tax deadlines', () => {
  it("moves the JOPPD for 2025 from Saturday 28 Feb to Monday 2 Mar 2026, as Porezna's example does", () => {
    expect(joppdDue(2025)).toBe('2026-03-02')
  })

  it('moves the JOPPD for 2026 from Sunday 28 Feb to Monday 1 Mar 2027', () => {
    expect(joppdDue(2026)).toBe('2027-03-01')
  })

  it('moves the INO-DOH for 2026 to Monday 1 Feb 2027, with Friday 29 Jan as the safe day', () => {
    expect(inoDohDue(2026)).toEqual({ due: '2027-02-01', fileBy: '2027-01-29' })
  })

  it('leaves the 30 days of a payment on 16 Oct 2026 at Sunday 15 Nov', () => {
    expect(thirtyDaysDue(civil('2026-10-16'))).toBe('2026-11-15')
  })

  it('gives the INO-IZJAVA after a first payment on 15 Jul 2026 until 23 Jul', () => {
    expect(inoIzjavaDue(civil('2026-07-15'))).toBe('2026-07-23')
  })

  it('opens on 2026 until its JOPPD is due and on 2027 the day after', () => {
    expect(yearDueNext(civil('2027-02-15'))).toBe(2026)
    expect(yearDueNext(civil('2027-03-01'))).toBe(2026)
    expect(yearDueNext(civil('2027-03-02'))).toBe(2027)
    expect(yearDueNext(civil('2026-11-03'))).toBe(2026)
  })
})
