import { describe, expect, it } from 'vitest'

import type { OwnerPayScenario } from '../src/apps/company/packs/hr-doo/domain/scenarios/ownerPayScenarios'
import { forecastYear, planDefaults } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import { planAgainstActual } from '../src/apps/company/packs/hr-doo/domain/forecast/planAgainstActual'
import { planRow } from './fixtures/billingPlan'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { STEADY_CATEGORIES, STEADY_ROWS, planLine, planOwnerPay, steadyStudio } from './fixtures/steadyStudio'
import { director } from './fixtures/employees'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { SCENARIO_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'

const FLOOR_2026: OwnerPayScenario = {
  slug: 'floor-2026',
  label: 'Floor salary',
  year: 2026,
  components: [{ component: 'salary_gross', gross: 'floor', from: null, to: null, id: recordIdOf(SCENARIO_RECORDS, 'row-2') }],
}

/** Steady Studio's 2026 with a plan made in January: the tool at 150.00, the floor salary, and a fee of 6,000.00 a month but 5,500.00 in March. */
function plannedIn2026() {
  const owner = director()
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09']
  return steadyStudio({
    employees: [owner],
    director: owner,
    payScenarios: [FLOOR_2026],
    planLines: [planLine(null, 'ai-services', 150), planOwnerPay(2026, 'floor-2026', null, 3)],
    billingPlan: months.map((month) => planRow('Monthly fee', `2026-${month}-28`, month === '03' ? 5500 : 6000, 'example-client')),
  })
}

describe('planAgainstActual', () => {
  const forecast = forecastYear(plannedIn2026(), 2026, civil('2026-10-19'))
  const lines = planAgainstActual(forecast)
  const line = (key: string) => lines.find((entry) => entry.key === key)

  it('holds revenue against the billing plan’s rows of each month the ledger settles', () => {
    const revenue = line('revenue')
    expect(revenue?.months.map((entry) => entry.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    // March was planned at 5,500.00 and invoiced at 6,000.00.
    expect(revenue?.months[2]?.difference.amount).toBe(euros(500))
    expect(revenue?.plan.amount).toBe(euros(53500))
    expect(revenue?.actual.amount).toBe(euros(54000))
  })

  it('holds a category against its plan row, costs read positive', () => {
    const tool = line('ai-services')
    // 150.00 planned and 120.00 paid in each of the nine months.
    expect(tool?.cost).toBe(true)
    expect(tool?.months.every((entry) => entry.plan.amount === euros(150) && entry.actual.amount === euros(120))).toBe(true)
    expect(tool?.difference.amount).toBe(euros(-270))
  })

  it('holds the owner pay categories together against the plan’s scenario', () => {
    const pay = line('owner-pay')
    // The 2026 floor of 1,295.45 and health of 213.75 on top is 1,509.20 a month. The ledger paid
    // 1,000.00 of net pay and 200.00 of payroll tax each month.
    expect(pay?.months).toHaveLength(9)
    expect(pay?.months[0]?.plan.amount).toBe(euros(1509.2))
    expect(pay?.months[0]?.actual.amount).toBe(euros(1200))
    expect(pay?.difference.amount).toBe(euros(9 * (1200 - 1509.2)))
  })

  it('lets the scenario set the months the ledger has not settled', () => {
    const salary = forecast.ownerPay?.lines[0]?.forecast
    expect(salary?.months.slice(9).map((entry) => entry.figure.amount)).toEqual([euros(-1509.2), euros(-1509.2), euros(-1509.2)])
    expect(salary?.months.slice(0, 9).every((entry) => entry.figure.amount === 0)).toBe(true)
  })

  it('compares nothing in a year the ledger has not reached', () => {
    expect(planAgainstActual(forecastYear(plannedIn2026(), 2027, civil('2026-10-19')))).toEqual([])
  })
})

describe('planDefaults', () => {
  it('starts each category from what a month with no plan row takes', () => {
    const defaults = planDefaults(steadyStudio(), 2027, civil('2026-10-19'))
    const of = (slug: string) => defaults.find((entry) => entry.category.slug === slug)
    // The tool's twelve-month average, and September's pay carried forward, as pay is paid in arrears.
    expect(of('ai-services')?.average.amount).toBe(euros(-120))
    expect(of('ai-services')?.lastMonth).toBe(false)
    expect(of('salary-net')?.average.amount).toBe(euros(-1000))
    expect(of('salary-net')?.lastMonth).toBe(true)
    // The insurance's 30.00 of September over twelve months.
    expect(of('insurance')?.average.amount).toBe(euros(-2.5))
  })

  it('leaves out a category whose average runs against its bucket, which a plan row would turn around', () => {
    const categories = [...STEADY_CATEGORIES, ...PACK_CATEGORIES.filter((entry) => entry.slug === 'tax-refund')]
    const refunded = steadyStudio({ categories, transactions: withPackBuckets(ledger([...STEADY_ROWS, { date: '2026-05-12', amount: 240, category: 'tax-refund' }]), categories) })
    const defaults = planDefaults(refunded, 2027, civil('2026-10-19'))
    // A refund of 240.00 on a taxes category averages 20.00 a month of income.
    expect(defaults.some((entry) => entry.category.slug === 'tax-refund')).toBe(false)
    expect(defaults.some((entry) => entry.category.slug === 'ai-services')).toBe(true)
  })

  it('needs no registration day', () => {
    const base = steadyStudio()
    const unregistered = steadyStudio({ companyFacts: { ...base.companyFacts, companyRegistered: null } })
    expect(planDefaults(unregistered, 2027, civil('2026-10-19')).length).toBeGreaterThan(0)
  })
})
