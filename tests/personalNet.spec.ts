import { describe, expect, it } from 'vitest'

import type { CountedHubPart, HubFigures } from '../src/shared/app/appContribution'
import { personalNet } from '../src/shared/app/personalNet'
import type { PersonalApp } from '../src/shared/app/personalNet'
import { euros } from './fixtures/ledger'

const investments: PersonalApp = {
  name: 'Investments',
  notSetUp: false,
  currency: 'EUR',
  figures: { parts: [{ label: 'Investments value', cents: euros(40000), side: 'has', caption: null, to: '/investments' }], notes: ['1 holding without a price'] },
}

const loansFigures: HubFigures<CountedHubPart> = {
  parts: [
    { label: 'Owed to you', cents: euros(500), side: 'has', caption: null, to: '/loans' },
    { label: 'You owe in all', cents: euros(95000), side: 'owes', caption: 'Next €650.00: On 15 Dec, Example house loan', to: '/loans' },
  ],
  notes: [],
}

function loans(figures: PersonalApp['figures'], notSetUp = false): PersonalApp {
  return { name: 'Loans', notSetUp, currency: 'EUR', figures }
}

describe('What you own less what you owe', () => {
  it('adds what you have and takes off what you owe', () => {
    // 40,000.00 + 500.00 − 95,000.00.
    expect(personalNet([loans(loansFigures), investments])).toEqual({ sum: { state: 'ready', cents: euros(-54500) }, notSetUp: [], leavesOut: ['1 holding without a price'] })
  })

  it("adds the assets' whole value, and leaves what is yours after the loan as a caption that changes nothing", () => {
    const assets: PersonalApp = {
      name: 'Assets',
      notSetUp: false,
      currency: 'EUR',
      figures: { parts: [{ label: 'Assets value', cents: euros(256_254.8), side: 'has', caption: '€88,884.80 yours after the Home loan', to: '/assets' }], notes: [] },
    }
    const withHomeLoan = loans({ parts: [loansFigures.parts[0]!, { ...loansFigures.parts[1]!, cents: euros(150_000) }], notes: [] })

    // 40,000.00 + 500.00 + 256,254.80 − 150,000.00.
    expect(personalNet([withHomeLoan, investments, assets]).sum).toEqual({ state: 'ready', cents: euros(146_754.8) })
  })

  it('counts an app not set up as nothing and names it', () => {
    const notSetUp = loans(null, true)

    expect(personalNet([notSetUp, investments])).toEqual({ sum: { state: 'ready', cents: euros(40000) }, notSetUp: [notSetUp], leavesOut: ['1 holding without a price'] })
  })

  it('has nothing to add up while no app is set up', () => {
    const loansNotSetUp = loans(null, true)
    const investmentsNotSetUp = { ...investments, notSetUp: true, figures: null }

    expect(personalNet([loansNotSetUp, investmentsNotSetUp])).toEqual({ sum: { state: 'nothing' }, notSetUp: [loansNotSetUp, investmentsNotSetUp], leavesOut: [] })
  })

  it('waits while an app is opening', () => {
    expect(personalNet([loans('opening'), investments]).sum).toEqual({ state: 'opening' })
  })

  it('holds the sum back when an app failed to open, and names it', () => {
    const failed = loans('failed')

    expect(personalNet([failed, investments]).sum).toEqual({ state: 'failed', apps: [failed] })
  })

  it('refuses to add up apps that keep different currencies', () => {
    expect(personalNet([{ ...loans(loansFigures), currency: 'USD' }, investments]).sum).toEqual({ state: 'currencies' })
  })
})
