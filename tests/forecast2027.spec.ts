import { describe, expect, it } from 'vitest'

import type { OwnerPayScenario, ScenarioComponent } from '../src/packs/hr-doo/domain/scenarios/ownerPayScenarios'
import type { ComponentDraft } from '../src/packs/hr-doo/domain/scenarios/startingScenarios'
import type { HrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'
import { dividendCapacity } from '../src/packs/hr-doo/domain/dividend/dividendCapacity'
import { forecastYear } from '../src/packs/hr-doo/domain/forecast/forecastYear'
import { civil, euros } from './fixtures/ledger'
import { planLine, planOwnerPay, planPurchase, steadyStudio } from './fixtures/steadyStudio'
import { ZAGREB_RESIDENT } from './fixtures/zagrebResident'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { SCENARIO_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'

function scenario(slug: string, components: readonly ComponentDraft[]): OwnerPayScenario {
  return { slug, label: slug, year: 2027, components: components.map((component, index) => ({ ...component, id: recordIdOf(SCENARIO_RECORDS, `${slug}-${index}`) }) as ScenarioComponent) }
}

const FLOOR = scenario('floor', [
  { component: 'salary_gross', gross: 'floor', from: null, to: null },
  { component: 'dividend', amount: 'max', from: null, to: null },
])
const BOARD = scenario('board', [
  { component: 'salary_gross', gross: 'floor', from: null, to: civil('2027-05-31') },
  { component: 'director_basis', basis: 'board-only', from: civil('2027-06-01'), to: null },
  { component: 'dividend', amount: 'max', from: null, to: null },
])

/**
 * Steady Studio's 2027, planned on 19 October 2026: the floor salary until May, then the board
 * member basis from 1 June, a laptop of 1,600.00 bought on 10 March and a dividend of 5,000.00 in
 * June. Revenue and the other costs take their averages.
 */
function planned(): HrDooWorkbook {
  const base = steadyStudio()
  return steadyStudio({
    companyFacts: { ...base.companyFacts, ...ZAGREB_RESIDENT },
    payScenarios: [FLOOR, BOARD],
    planLines: [
      planOwnerPay(2027, 'floor', null, 2),
      planOwnerPay(2027, 'board', '2027-06-01', 3),
      planPurchase('2027-03-10', 1600, 'computers', 'Second laptop', 4),
      planLine(6, 'dividend', 5000, '', 2027),
    ],
  })
}

describe('forecastYear for the year after the newest booking, with a plan', () => {
  const forecast = forecastYear(planned(), 2027, civil('2026-10-19'))

  it('takes the owner pay from the floor salary until May, then nothing as a board member only', () => {
    const salary = forecast.ownerPay?.lines[0]?.forecast
    // The 2027 floor is 1,413.75. Health of 16.5% on top is 233.27, so each month costs 1,647.02.
    expect(salary?.months.map((entry) => entry.figure.amount)).toEqual([...Array.from({ length: 5 }, () => euros(-1647.02)), ...Array.from({ length: 7 }, () => 0)])
    expect(salary?.total.amount).toBe(euros(-8235.1))
    // The owner pay categories give way to it in every month of the year.
    const pay = forecast.categories.find((entry) => entry.category.slug === 'salary-net')
    expect(pay?.forecast.total.amount).toBe(0)
    expect(forecast.ownerPay?.salaryDropped).toEqual([])
  })

  it('depreciates the planned laptop from April beside the one already owned', () => {
    // 1,600.00 at 50% is 800.00 a year, 600.00 for April to December. The laptop bought in July
    // 2026 depreciates 1,200.00 in its first full year.
    expect(forecast.plannedAssets.map((asset) => asset.name)).toEqual(['Second laptop, planned'])
    expect(forecast.depreciation.total.amount).toBe(euros(1800))
  })

  it('works the profit and the corporate tax out of the year', () => {
    // Revenue 72,000.00 at the average of 6,000.00. Costs: the tool 1,440.00, the insurance paid
    // ahead to August 243.00 and averaged at 2.50 for September to December, owner pay 8,235.10
    // and depreciation 1,800.00, 11,728.10 in all.
    expect(forecast.taxBase.revenue.amount).toBe(euros(72000))
    expect(forecast.taxBase.expenses.amount).toBe(euros(11728.1))
    expect(forecast.profitBeforeTax.total.amount).toBe(euros(60271.9))
    expect(forecast.liability.liability.amount).toBe(euros(6027.19))
  })

  it('pays January to March at the 2025 advance and the rest at the 2026 forecast’s, leaving the balance to 2028', () => {
    // 3 × 100.00 and 9 × 462.82, the 2026 forecast's 5,553.80 over twelve.
    expect(forecast.cit.advancesToCome.amount).toBe(euros(4465.38))
    expect(forecast.liability.balanceDue?.amount).toBe(euros(1561.81))
    expect(forecast.cit.balanceDue?.dueOn).toBe('2028-04-30')
  })

  it('pays the dividend in June, its tax and what the owner’s loan does not take', () => {
    // 12% tax is 600.00, so 4,400.00 net. The owner owes the 3,000.00 lent in March 2026, which
    // the net settles first, so 600.00 + 1,400.00 leaves the cash.
    expect(forecast.plannedDividend?.tax.amount).toBe(euros(600))
    expect(forecast.plannedDividend?.setOff.amount).toBe(euros(3000))
    expect(forecast.plannedDividend?.cashOut.amount).toBe(euros(2000))
  })

  it('moves the cash by what each month pays and receives', () => {
    const change = (index: number) => (forecast.cashByMonth[index]?.closing.amount ?? 0) - (forecast.cashByMonth[index - 1]?.closing.amount ?? 0)
    // June: May's revenue of 6,000.00 on the 20th, the tool's 120.00, May's salary paid in
    // arrears 1,647.02, the dividend's 2,000.00 and the May advance of 462.82.
    expect(change(5)).toBe(euros(6000 - 120 - 1647.02 - 2000 - 462.82))
    // July: June's revenue, the tool and the June advance. June pays no salary.
    expect(change(6)).toBe(euros(6000 - 120 - 462.82))
    // March: February's revenue, the tool, February's salary, the February advance and the laptop.
    expect(change(2)).toBe(euros(6000 - 120 - 1647.02 - 100 - 1600))
  })

  it('counts the planned dividend as paid out in the year and the set-off against what the owner owes', () => {
    const capacity = dividendCapacity(2027, forecast, planned())
    expect(capacity.paidOutInYear.amount).toBe(euros(5000))
    expect(capacity.prudence.owedByOwner.amount).toBe(0)
    // 54,244.71 after tax, 54,784.20 retained from 2026, less the 5,000.00 paid out.
    expect(capacity.profitAfterTax.amount).toBe(euros(54244.71))
    expect(capacity.distributable.amount).toBe(euros(54244.71 + 54784.2 - 5000))
  })
})
