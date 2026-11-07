import { describe, expect, it } from 'vitest'

import { endingLinks, hasLiveLink } from '../src/apps/spending/bankSync/domain/bankLinks'
import { bankLinkLines } from '../src/apps/spending/bankSync/presentation/bankLinkLines'
import type { SpendingSettings } from '../src/apps/spending/workbook/domain/spendingSettings'
import { addDays } from '../src/shared/calendar/civilDate'
import { civil } from './fixtures/ledger'

const DAY = civil('2026-10-30')

function settings(otpIn: number | null, revolutIn: number | null = null, deployment = 'AKfycb-made-up'): SpendingSettings {
  const until = (days: number | null) => (days === null ? null : addDays(DAY, days))
  return { bankSyncDeployment: deployment, bankLinks: { otp: until(otpIn), revolut: until(revolutIn) }, companyOib: '', personPayees: [] }
}

describe('the end of a link', () => {
  it('says nothing 15 days before and says so from 14', () => {
    expect(endingLinks(settings(15), DAY)).toEqual([])
    expect(endingLinks(settings(14), DAY)).toEqual([{ bank: 'otp', endsOn: addDays(DAY, 14), ended: false }])
  })

  it('counts its last day as live, and marks the day after as ended', () => {
    expect(hasLiveLink(settings(0), DAY)).toBe(true)
    expect(hasLiveLink(settings(-1), DAY)).toBe(false)
    expect(endingLinks(settings(-1), DAY)).toEqual([{ bank: 'otp', endsOn: addDays(DAY, -1), ended: true }])
  })

  it('names each bank whose link runs out on the home card', () => {
    expect(bankLinkLines(settings(13, 2), DAY)).toEqual(['The link to OTP ends on 12 Nov 2026. Link it again.', 'The link to Revolut ends on 1 Nov 2026. Link it again.'])
    expect(bankLinkLines(settings(-3), DAY)).toEqual(['The link to OTP ended on 27 Oct 2026. Link it again.'])
  })

  it('is silent and has nothing live with no script saved, whatever the file holds', () => {
    expect(bankLinkLines(settings(2, null, ''), DAY)).toEqual([])
    expect(hasLiveLink(settings(30, null, ''), DAY)).toBe(false)
  })
})
