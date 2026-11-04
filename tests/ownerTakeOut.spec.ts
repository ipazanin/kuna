import { describe, expect, it } from 'vitest'

import { ownerTakeOut } from '../src/apps/company/packs/hr-doo/presentation/ownerTakeOut'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { STEADY_CATEGORIES, STEADY_ROWS, steadyStudio } from './fixtures/steadyStudio'

describe('what the owner could take out of the company now', () => {
  it('gives the kept profit as it reaches the owner, after what settles the loan', () => {
    // 4,800.00 kept, 576.00 of dividend tax, and 3,000.00 of the 4,224.00 net settles the loan.
    expect(ownerTakeOut(steadyStudio(), civil('2026-10-19'))).toEqual({
      kind: 'figure',
      label: 'You could take out now',
      cents: euros(1224),
      caption: 'After €3,000.00 settles your loan to the company',
      to: { path: '/company/year', query: { year: '2026', tab: 'pay', payout: 'kept-now' } },
    })
  })

  it('says the tax alone when the owner owes the company nothing', () => {
    const rows = STEADY_ROWS.filter((row) => row.category !== 'owner-loan-out')
    const takeOut = ownerTakeOut(steadyStudio({ transactions: withPackBuckets(ledger(rows), STEADY_CATEGORIES) }), civil('2026-10-19'))

    expect(takeOut).toMatchObject({ cents: euros(4224), caption: 'After 12% dividend tax' })
  })

  it('says why nothing can be paid without year-end figures', () => {
    const takeOut = ownerTakeOut(steadyStudio({ yearEndLines: [] }), civil('2026-10-19'))

    expect(takeOut).toMatchObject({ cents: euros(0), caption: 'Nothing yet: no year-end figures from the accountant' })
  })

  it('says the closed years’ profit is paid out when nothing is kept', () => {
    // 2025's 10,800.00 less 6,000.00 in February and 6,000.00 more on 8 October.
    const rows = [...STEADY_ROWS, { date: '2026-10-08', amount: -6000, category: 'dividend' }].sort((earlier, later) => earlier.date.localeCompare(later.date))
    const takeOut = ownerTakeOut(steadyStudio({ transactions: withPackBuckets(ledger(rows), STEADY_CATEGORIES) }), civil('2026-10-19'))

    expect(takeOut).toMatchObject({ cents: euros(0), caption: 'Nothing kept: the closed years’ profit is paid out' })
  })

  it('says no cash is free when what falls due takes it all', () => {
    // 72,595.00 spent on 10 October leaves nothing for the 100.00 advance due on 31 October.
    const rows = [...STEADY_ROWS, { date: '2026-10-10', amount: -72595, category: 'consulting' }].sort((earlier, later) => earlier.date.localeCompare(later.date))
    const takeOut = ownerTakeOut(steadyStudio({ transactions: withPackBuckets(ledger(rows), STEADY_CATEGORIES) }), civil('2026-10-19'))

    expect(takeOut).toMatchObject({ cents: euros(0), caption: 'No cash free after what falls due' })
  })

  it('says why without the day the company was registered', () => {
    const workbook = steadyStudio()

    expect(ownerTakeOut({ ...workbook, companyFacts: { ...workbook.companyFacts, companyRegistered: null } }, civil('2026-10-19'))).toEqual({
      kind: 'missing',
      reason: 'What you could take out needs the company’s registration day in Settings.',
    })
  })
})
