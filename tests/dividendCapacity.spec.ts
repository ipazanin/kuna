import { describe, expect, it } from 'vitest'

import { dividendCapacity } from '../src/packs/hr-doo/domain/dividend/dividendCapacity'
import type { DividendCapacity, PayoutOption, PayoutOptionId } from '../src/packs/hr-doo/domain/dividend/dividendCapacity'
import { forecastYear } from '../src/packs/hr-doo/domain/forecast/forecastYear'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { subtractMoney } from '../src/shared/money/money'
import { yearEndLine } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { STEADY_CATEGORIES, STEADY_ROWS, STEADY_YEAR_END_2025, planLine, steadyStudio } from './fixtures/steadyStudio'

function capacity(year: number, workbook: Workbook = steadyStudio(), asOf = '2026-10-19'): DividendCapacity {
  return dividendCapacity(year, forecastYear(workbook, year, civil(asOf)), workbook)
}

function option(result: DividendCapacity, id: PayoutOptionId): PayoutOption {
  const found = result.options.find((entry) => entry.id === id)
  if (found === undefined) {
    throw new Error(`No option ${id}`)
  }
  return found
}

describe('dividendCapacity, after a payout already made in the year', () => {
  const result = capacity(2026)

  it('adds the year’s profit to what was retained, less what the year paid out', () => {
    // 2025 left 10,800.00 retained, and 6,000.00 of it was paid out with its tax in February.
    expect(result.profitAfterTax.amount).toBe(euros(49984.2))
    expect(result.retainedEarnings.amount).toBe(euros(10800))
    expect(result.lossesBroughtForward.amount).toBe(euros(0))
    expect(result.paidOutInYear.amount).toBe(euros(6000))
    expect(result.distributable.amount).toBe(euros(54784.2))
  })

  it('keeps the share capital covered and gives the members’ deadline', () => {
    expect(result.shareCapital.amount).toBe(euros(2500))
    expect(result.netAssetsAtYearEnd.amount).toBe(euros(57284.2))
    expect(result.maxPayout.amount).toBe(euros(54784.2))
    expect(result.decideBy).toBe('2027-08-31')
  })

  it('weighs the payout against cash, the bills of December, the tax balance and the grant', () => {
    const { prudence } = result
    // The grant's second year runs from 1 June 2026, with 500.00 at risk.
    expect(prudence.clawbackExposure.amount).toBe(euros(500))
    expect(prudence.clawbackExposure.on).toBe('2026-12-31')
    expect(prudence.clawbackExposure.steps.map((step) => [step.label, step.on])).toEqual([['example-grant: Clawback if a condition breaks in the second year, until', '2027-05-31']])
    expect(prudence.cashAtYearEnd.amount).toBe(euros(88255))
    expect(prudence.balanceDue.amount).toBe(euros(4653.8))
    // December's pay and payroll tax, and the December advance due on 31 January.
    expect(prudence.decemberDue.amount).toBe(euros(1300))
    // 88,255.00 with December's 6,000.00 received, less 1,300.00 and 4,653.80.
    expect(prudence.cashAfterObligations.amount).toBe(euros(88301.2))
    expect(prudence.owedByOwner.amount).toBe(euros(3000))
    expect(prudence.deterioration.ruleId).toBe('hr.ztd.withhold-on-deterioration')
  })

  it('takes VAT owed off once, inside cash at the year end', () => {
    const workbook = steadyStudio()
    const forecast = forecastYear(workbook, 2026, civil('2026-10-19'))
    const owingVat = dividendCapacity(2026, { ...forecast, vatPosition: { ...forecast.vatPosition, amount: euros(-800) } }, workbook)

    expect(owingVat.prudence.decemberDue.amount).toBe(result.prudence.decemberDue.amount)
    expect(owingVat.prudence.cashAfterObligations.amount).toBe(result.prudence.cashAfterObligations.amount)
  })

  it('pays everything out once the statements are adopted, set off against the owner’s loan', () => {
    const payout = option(result, 'after-adoption')

    expect([payout.earliestOn, payout.latestOn]).toEqual(['2027-01-01', '2027-08-31'])
    expect(payout.gross.amount).toBe(euros(54784.2))
    // 12% of 54,784.20 is 6,574.104.
    expect(payout.dividendTax.amount).toBe(euros(6574.1))
    expect(payout.net.amount).toBe(euros(48210.1))
    expect(payout.setOff.amount).toBe(euros(3000))
    expect(payout.cashOut.amount).toBe(euros(51784.2))
    expect(payout.cashLeft.amount).toBe(euros(36517))
    expect(payout.owedByOwnerAfter.amount).toBe(euros(0))
    expect(payout.loanBenefitPerYear.amount).toBe(euros(0))
    expect(payout.netAssetsAfter.amount).toBe(euros(2500))
    expect(payout.capitalProtected).toBe(true)
    expect(payout.clawbackExposure.amount).toBe(euros(500))
    expect(payout.shortfall).toBeNull()
    expect(payout.retainedAfter.amount).toBe(euros(0))
  })

  it('pays an interim payout now on the profit of the complete months, in cash', () => {
    const payout = option(result, 'interim')

    expect([payout.earliestOn, payout.latestOn]).toEqual(['2026-10-19', '2026-12-31'])
    // January to September: revenue 54,000.00 less pay 9,000.00, payroll tax 1,800.00, the tool
    // 1,080.00, insurance 30.00 and depreciation 200.00 is 41,890.00, and 37,701.00 after 10% tax.
    // With the 10,800.00 retained and less the 6,000.00 paid out, 42,501.00.
    expect(payout.gross.amount).toBe(euros(42501))
    expect(payout.dividendTax.amount).toBe(euros(5100.12))
    expect(payout.setOff.amount).toBe(euros(0))
    expect(payout.cashOut.amount).toBe(euros(42501))
    // 72,595.00 on 10 October less the September advance of 100.00 due on 31 October, less the payout.
    expect(payout.cashLeft.amount).toBe(euros(29994))
    expect(payout.owedByOwnerAfter.amount).toBe(euros(3000))
    // 2% of the 3,000.00 that stays lent.
    expect(payout.loanBenefitPerYear.amount).toBe(euros(60))
    expect(payout.shortfall?.amount).toBe(euros(0))
    expect(payout.retainedAfter.amount).toBe(euros(12283.2))
    expect(payout.capitalProtected).toBe(true)
  })

  it('pays the interim payout from the cash on the newest booking, less what falls due that month', () => {
    const cash = option(result, 'interim').cashNow

    expect([cash?.cash.amount, cash?.cash.on]).toEqual([euros(72595), '2026-10-10'])
    expect([cash?.fallingDue.amount, cash?.fallingDue.on]).toEqual([euros(100), '2026-10-31'])
    expect(cash?.available.amount).toBe(euros(72495))
    expect(cash?.largestPayout.amount).toBe(euros(42501))
    expect(option(result, 'after-adoption').cashNow).toBeNull()
    expect(option(result, 'keep').cashNow).toBeNull()
  })

  it('keeps the profit in the company', () => {
    const kept = option(result, 'keep')

    expect([kept.earliestOn, kept.latestOn]).toEqual([null, null])
    expect(kept.gross.amount).toBe(euros(0))
    expect(kept.cashLeft.amount).toBe(euros(88301.2))
    expect(kept.retainedAfter.amount).toBe(euros(54784.2))
    expect(kept.owedByOwnerAfter.amount).toBe(euros(3000))
    expect(kept.loanBenefitPerYear.amount).toBe(euros(60))
    expect(kept.clawbackExposure.amount).toBe(euros(0))
  })
})

describe('dividendCapacity of an interim payout the cash does not cover', () => {
  // 40,000.00 lent to the owner on 6 October leaves the profit as it is and the bank with 32,595.00.
  const rows = [...STEADY_ROWS, { date: '2026-10-06', amount: -40000, category: 'owner-loan-out' }].sort((earlier, later) => earlier.date.localeCompare(later.date))
  const result = capacity(2026, steadyStudio({ transactions: withPackBuckets(ledger(rows), STEADY_CATEGORIES) }))
  const payout = option(result, 'interim')

  it('keeps the payout the profit allows and gives the largest one the cash covers', () => {
    expect(payout.gross.amount).toBe(euros(42501))
    // 32,595.00 less the 100.00 advance due on 31 October.
    expect(payout.cashNow?.available.amount).toBe(euros(32495))
    expect(payout.cashNow?.largestPayout.amount).toBe(euros(32495))
    expect(payout.cashLeft.amount).toBe(euros(-10006))
  })

  it('weighs the payouts after the year against cash at the year end', () => {
    const afterAdoption = option(result, 'after-adoption')

    expect(afterAdoption.cashLeft.amount).toBe(subtractMoney(result.prudence.cashAfterObligations.amount, afterAdoption.cashOut.amount))
    expect(option(result, 'keep').cashLeft.amount).toBe(result.prudence.cashAfterObligations.amount)
  })
})

describe('dividendCapacity of an interim payout before the month’s pay is paid', () => {
  it('takes off the pay of the last complete month the ledger has not paid yet', () => {
    // On 9 October the September pay of 1,000.00 and its 200.00 of tax, paid on the 10th, are still to pay.
    const cash = option(capacity(2026, steadyStudio(), '2026-10-09'), 'interim').cashNow

    expect([cash?.cash.amount, cash?.cash.on]).toEqual([euros(73795), '2026-10-05'])
    expect(cash?.fallingDue.amount).toBe(euros(1300))
    expect(cash?.available.amount).toBe(euros(72495))
  })
})

describe('dividendCapacity when the rest of the year makes a loss', () => {
  // 20,000.00 a month of consulting from October turns the year's 55,538.00 into a loss of 4,462.00.
  const result = capacity(2026, steadyStudio({ planLines: [planLine(null, 'consulting', 20000)] }))

  it('limits the payout to what the year leaves distributable', () => {
    expect(result.profitAfterTax.amount).toBe(euros(-4462))
    expect(result.distributable.amount).toBe(euros(338))
    expect(option(result, 'after-adoption').gross.amount).toBe(euros(338))
  })

  it('flags the part of an interim payout the year does not cover, and the share capital it breaks', () => {
    const payout = option(result, 'interim')

    expect(payout.gross.amount).toBe(euros(42501))
    expect(payout.shortfall?.amount).toBe(euros(42163))
    expect(payout.shortfall?.rules.map((citation) => citation.ruleId)).toEqual(['hr.cit.profit-advance-shortfall'])
    expect(payout.capitalProtected).toBe(false)
  })
})

describe('dividendCapacity with losses brought forward', () => {
  it('takes them off before anything is distributable', () => {
    const lines = [
      ...STEADY_YEAR_END_2025.filter((line) => line.line !== 'retained-earnings' && line.line !== 'profit-of-year'),
      yearEndLine(2025, 'balance', 'retained-earnings', -2000),
      yearEndLine(2025, 'balance', 'profit-of-year', 500),
    ]
    const result = capacity(2026, steadyStudio({ yearEndLines: lines }))

    expect(result.retainedEarnings.amount).toBe(euros(0))
    expect(result.lossesBroughtForward.amount).toBe(euros(1500))
    // 49,984.20 less the 1,500.00 of losses and the 6,000.00 paid out.
    expect(result.distributable.amount).toBe(euros(42484.2))
  })
})

describe('dividendCapacity of a first period', () => {
  it('brings nothing forward and reads the share capital from the law', () => {
    const result = capacity(2025, steadyStudio({ yearEndLines: [] }), '2025-10-19')

    expect(result.retainedEarnings.amount).toBe(euros(0))
    expect(result.paidOutInYear.amount).toBe(euros(0))
    expect(result.shareCapital.amount).toBe(euros(2500))
    expect(result.shareCapital.rules.map((citation) => citation.ruleId)).toEqual(['hr.ztd.min-share-capital'])
    expect(result.decideBy).toBe('2026-08-31')
  })
})

describe('dividendCapacity of a year the year-end tab has not reached', () => {
  it('carries in the year before’s forecast profit, less what that year paid out', () => {
    const result = capacity(2027)

    // 10,800.00 retained into 2026, less 6,000.00 paid out, plus the 2026 forecast of 49,984.20.
    expect(result.retainedEarnings.amount).toBe(euros(54784.2))
    expect(result.paidOutInYear.amount).toBe(euros(0))
  })
})
