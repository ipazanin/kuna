import { describe, expect, it } from 'vitest'

import { companyHomeFigures } from '../src/apps/company/home/domain/homeFigures'
import { euros, ledger } from './fixtures/ledger'

describe("the company's card on the home", () => {
  it('adds every account at its latest balance and counts the rows waiting for review', () => {
    const rows = ledger([
      { date: '2026-08-01', account: 'main', amount: 2000, category: 'revenue' },
      { date: '2026-08-20', account: 'savings', amount: 500, category: 'internal-transfer' },
      { date: '2026-09-02', account: 'main', amount: -120, category: 'ai-services', flaggedBy: 'ai' },
      { date: '2026-09-15', account: 'main', amount: -40, category: 'mystery' },
    ])

    // main closes at 2,000 − 120 − 40 = 1,840, beside the 500 kept in savings.
    expect(companyHomeFigures(rows)).toEqual({ cashOnHand: euros(2340), toReview: 2 })
  })

  it('shows nothing on hand and nothing waiting for books without rows', () => {
    expect(companyHomeFigures([])).toEqual({ cashOnHand: euros(0), toReview: 0 })
  })
})
