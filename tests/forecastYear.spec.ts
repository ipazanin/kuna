import { describe, expect, it } from 'vitest'

import { INVOICE_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { MonthBasis } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastLines'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import type { YearForecast } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import { accrualYear } from '../src/apps/company/packs/hr-doo/domain/accrual/accrualYear'
import type { Money } from '../src/shared/money/money'
import { planRow } from './fixtures/billingPlan'
import { civil, euros } from './fixtures/ledger'
import { STEADY_INVOICES, planLine, planOwnerPay, planPurchase, steadyStudio } from './fixtures/steadyStudio'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

function categoryLine(forecast: YearForecast, slug: string) {
  const found = forecast.categories.find((entry) => entry.category.slug === slug)
  if (found === undefined) {
    throw new Error(`No forecast for ${slug}`)
  }
  return found.forecast
}

function amounts(line: { readonly months: readonly { readonly figure: { readonly amount: Money } }[] }): Money[] {
  return line.months.map((entry) => entry.figure.amount)
}

function bases(line: { readonly months: readonly { readonly bases: readonly MonthBasis[] }[] }): (readonly MonthBasis[])[] {
  return line.months.map((entry) => entry.bases)
}

const NINE: readonly MonthBasis[][] = Array.from({ length: 9 }, () => ['actual'])

describe('forecastYear, the year still running', () => {
  const forecast = forecastYear(steadyStudio(), 2026, civil('2026-10-19'))

  it('counts the complete months from the ledger and never the running one', () => {
    expect(forecast.calendar.lastComplete).toBe('2026-09')
    expect(forecast.calendar.running).toBe('2026-10')
    const tool = categoryLine(forecast, 'ai-services')
    expect(bases(tool)).toEqual([...NINE, ['averaged'], ['averaged'], ['averaged']])
    // October's 120.00 paid on the 5th is shown, and the month counts the average instead.
    expect(tool.months[9]?.soFar?.amount).toBe(euros(-120))
    expect(tool.months[9]?.figure.amount).toBe(euros(-120))
    expect(tool.months[8]?.soFar).toBeNull()
  })

  it('averages each line over its last twelve actual months', () => {
    // Invoices of 6,000.00 a month from October 2025 to September 2026.
    expect(forecast.revenue.averagedOver).toEqual({ from: '2025-10', to: '2026-09', monthCount: 12 })
    expect(amounts(forecast.revenue)).toEqual(Array.from({ length: 12 }, () => euros(6000)))
    expect(bases(forecast.revenue)).toEqual([...NINE, ['averaged'], ['averaged'], ['averaged']])
    // September's pay is paid on 10 October, so September is actual too. Pay is paid in arrears,
    // so the later months carry September forward instead of a twelve-month average.
    expect(amounts(categoryLine(forecast, 'salary-net'))).toEqual(Array.from({ length: 12 }, () => euros(-1000)))
    expect(categoryLine(forecast, 'salary-net').averagedOver).toEqual({ from: '2026-09', to: '2026-09', monthCount: 1 })
    expect(categoryLine(forecast, 'salary-net').average?.label).toBe('As in Sep 2026, the last month the ledger settles')
  })

  it('takes the months a cost paid ahead already covers from its spread, not the average', () => {
    const insurance = categoryLine(forecast, 'insurance')
    // 1.00 a day from 1 September: 30 days, then 31, 30 and 31.
    expect(amounts(insurance).slice(8)).toEqual([euros(-30), euros(-31), euros(-30), euros(-31)])
    expect(bases(insurance).slice(8)).toEqual([['actual'], ['paid-ahead'], ['paid-ahead'], ['paid-ahead']])
  })

  it('depreciates an asset bought in the year from the month after it is put in use', () => {
    // 2,400.00 at 50% a year is 100.00 a month from August.
    expect(amounts(forecast.depreciation)).toEqual([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100].map(euros))
    expect(bases(forecast.depreciation).every((entry) => entry.length === 1 && entry[0] === 'scheduled')).toBe(true)
    expect(forecast.depreciation.total.amount).toBe(euros(500))
    // The purchase itself goes to the asset books, so equipment has no cost line.
    expect(forecast.categories.some((entry) => entry.category.slug === 'equipment')).toBe(false)
  })

  it('builds profit and the PD return from the whole year', () => {
    // Revenue 72,000.00 less pay 12,000.00, payroll tax 2,400.00, the tool 1,440.00, insurance
    // 122.00 and depreciation 500.00.
    expect(forecast.taxBase.revenue.amount).toBe(euros(72000))
    expect(forecast.taxBase.expenses.amount).toBe(euros(16462))
    expect(forecast.profitBeforeTax.total.amount).toBe(euros(55538))
    expect(forecast.taxBase.profitBeforeTax.amount).toBe(euros(55538))
    expect(forecast.liability.liability.amount).toBe(euros(5553.8))
    expect(forecast.profitAfterTax.amount).toBe(euros(49984.2))
  })

  it('lists the categories and engine lines each profit and loss line adds up, signed to sum to it', () => {
    for (const entry of forecast.lines) {
      expect(entry.parts.reduce((total, part) => total + part.sign * part.line.total.amount, 0)).toBe(entry.forecast.total.amount)
    }
    const material = forecast.lines.find((entry) => entry.line === 'material-costs')
    expect(material?.parts.map((part) => part.line)).toEqual(expect.arrayContaining([forecast.smallInventory]))
    expect(forecast.lines.find((entry) => entry.line === 'other-operating-income')?.parts[0]?.line).toBe(forecast.grantRelease)
  })

  it('puts the advances paid and those still to come on PD line 56', () => {
    // The 2025 return sets 1,200.00 / 12 = 100.00 a month from April. April to August are paid.
    expect(forecast.cit.advancesPaid.amount).toBe(euros(500))
    expect(forecast.cit.advancesPaid.steps).toHaveLength(5)
    expect(forecast.cit.advancesToCome.amount).toBe(euros(400))
    expect(forecast.cit.advancesToCome.steps.map((step) => [step.label, step.on])).toEqual([
      ['Advance for Sep 2026, due', '2026-10-31'],
      ['Advance for Oct 2026, due', '2026-11-30'],
      ['Advance for Nov 2026, due', '2026-12-31'],
      ['Advance for Dec 2026, due', '2027-01-31'],
    ])
    expect(forecast.liability.advancesPaid?.amount).toBe(euros(900))
    expect(forecast.cit.obligations.map((entry) => entry.status)).toEqual(['paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'due', 'to-come', 'to-come', 'to-come'])
  })

  it('leaves the balance due and the new monthly advance to the next year', () => {
    // 5,553.80 less 900.00, and 5,553.80 / 12 = 462.82 from the April advance.
    expect(forecast.liability.balanceDue?.amount).toBe(euros(4653.8))
    expect(forecast.cit.balanceDue?.dueOn).toBe('2027-04-30')
    expect(forecast.cit.balanceDue?.expected.amount).toBe(euros(4653.8))
    expect(forecast.cit.newAdvance?.month).toBe('2027-04')
    expect(forecast.cit.newAdvance?.dueOn).toBe('2027-05-31')
    expect(forecast.cit.newAdvance?.expected.amount).toBe(euros(462.82))
    // January to March 2027 are still set by the 2025 return.
    expect(forecast.cit.nextYear.obligations.filter((entry) => entry.kind === 'advance' && entry.month !== null && entry.month < '2027-04').map((entry) => entry.expected.amount)).toEqual(
      [100, 100, 100].map(euros),
    )
  })

  it('holds December’s revenue as a receivable and its pay as owed into January', () => {
    expect(forecast.receivableAtYearEnd.amount).toBe(euros(6000))
    expect(forecast.decemberArrears.amount).toBe(euros(1200))
  })

  it('projects cash to the year end as each forecast month is paid', () => {
    expect(forecast.cashAtYearEnd.steps[0]?.on).toBe('2026-10-10')
    expect(forecast.cashAtYearEnd.steps.map((step) => [step.label, step.amount])).toEqual([
      // Every bank row, the newest on 10 October.
      ['Cash on', euros(72595)],
      // September's invoice of the 30th, paid 20 days after its issue as the client pays.
      ['Invoices still open, as the clients pay', euros(6000)],
      ['VAT the state owes the company now, settled the month after', euros(600)],
      // October and November, each paid 20 days after the month. December's comes in January.
      ['Revenue of the forecast months, as the client pays', euros(12000)],
      // The tool for November and December, October's already paid, and pay and payroll tax for
      // October and November.
      ['Costs and other income of the forecast months, as they are paid', euros(-2640)],
      // The September to November advances.
      ['Corporate tax still to pay', euros(-300)],
    ])
    expect(forecast.cashAtYearEnd.amount).toBe(euros(88255))
    expect(forecast.paymentLag.days).toBe(20)
  })

  it('gives cash at every month end, the bank balance to September and projected after it', () => {
    const months = forecast.cashByMonth
    expect(months.map((entry) => entry.basis)).toEqual([...Array.from({ length: 9 }, () => 'ledger'), 'forecast', 'forecast', 'forecast'])
    expect(months[11]?.closing.amount).toBe(forecast.cashAtYearEnd.amount)
    // October: 72,595.00 on the 10th, then September's invoice of 6,000.00 on the 20th, the
    // tool's 120.00 less the 120.00 already paid, and the September advance of 100.00.
    expect(months[9]?.closing.amount).toBe(euros(72595 + 6000 - 100))
    // November: the VAT position of 600.00, October's revenue of 6,000.00, the tool at 120.00,
    // October's pay and payroll tax of 1,200.00 and the October advance of 100.00.
    expect(months[10]?.closing.amount).toBe(euros(78495 + 600 + 6000 - 120 - 1200 - 100))
  })

  it('counts runway as cash at the year end over the cash cost of October to December', () => {
    // Each month costs 120.00 for the tool and 1,200.00 for pay and payroll tax, the insurance
    // 1.00 a day for 31, 30 and 31 days, and the September to November advances of 100.00 fall
    // due. The 100.00 of depreciation a month pays nothing. 4,352.00 over three months is
    // 1,450.67 a month.
    const costs = 3 * (120 + 1200 + 100) + 31 + 30 + 31
    expect(forecast.runway.monthlyCost.amount).toBe(euros(1450.67))
    expect(forecast.runway.months).toBeCloseTo((88255 * 3) / costs, 6)
    const steps = forecast.runway.monthlyCost.steps[0]?.steps ?? []
    expect(steps.filter((step) => step.label.startsWith('Depreciation')).reduce((total, step) => total + step.amount, 0)).toBe(0)
    expect(steps.filter((step) => step.label.startsWith('Advance for')).map((step) => step.amount)).toEqual([euros(100), euros(100), euros(100)])
  })
})

describe('forecastYear with plan rows', () => {
  const workbook = steadyStudio({
    billingPlan: [
      planRow('Monthly fee', '2026-11-30', 5700, 'example-client'),
      planRow('Hotel', '2026-11-12', 300, 'example-client'),
      planRow('Monthly fee', '2026-12-31', 7000, 'example-client', 'A bigger December'),
    ],
    planLines: [
      planLine(12, 'revenue', 7000, 'Moved to the billing plan'),
      planLine(null, 'ai-services', 150),
      planLine(2, 'ai-services', 999, 'Replaced by the ledger'),
      planPurchase('2026-11-12', 400, 'equipment', 'A monitor'),
      planLine(6, 'dividend', 8000),
      planLine(3, 'owner-loan-out', 500),
      planOwnerPay(2026, 'floor-salary', null, 9),
    ],
  })
  const forecast = forecastYear(workbook, 2026, civil('2026-10-19'))

  it('reads revenue from the billing plan rows still to invoice in their month, and averages a month without any', () => {
    expect(amounts(forecast.revenue).slice(9)).toEqual([euros(6000), euros(6000), euros(7000)])
    expect(bases(forecast.revenue).slice(9)).toEqual([['averaged'], ['planned'], ['planned']])
    const november = forecast.revenue.months[10]?.figure
    expect(november?.label).toBe('Revenue, Nov 2026: planned from the billing plan')
    expect(november?.basis).toBe('plan')
    expect(november?.steps.map((step) => [step.label, step.on, step.amount])).toEqual([
      ['Hotel for Example client, billable', '2026-11-12', euros(300)],
      ['Monthly fee for Example client, billable', '2026-11-30', euros(5700)],
    ])
  })

  it('names a client the clients tab gives no name by its slug', () => {
    const unnamed = forecastYear({ ...workbook, clients: [{ slug: 'example-client', name: '', ibans: [], invoicing: NO_CLIENT_INVOICING }] }, 2026, civil('2026-10-19'))

    expect(unnamed.revenue.months[11]?.figure.steps.map((step) => step.label)).toEqual(['Monthly fee for example-client, billable'])
  })

  it('takes a month’s own row before the row for every month, and never over the ledger', () => {
    const tool = categoryLine(forecast, 'ai-services')
    expect(amounts(tool)).toEqual([...Array.from({ length: 9 }, () => -120), -150, -150, -150].map(euros))
    expect(bases(tool).slice(9)).toEqual([['planned'], ['planned'], ['planned']])
  })

  it('writes off a planned purchase at or below the threshold in its month, through the asset books', () => {
    expect(forecast.plannedAssets.map((asset) => [asset.name, asset.bought, asset.costNet])).toEqual([['A monitor, planned', '2026-11-12', euros(400)]])
    expect(forecast.smallInventory.months[10]?.figure.amount).toBe(euros(400))
    expect(forecast.smallInventory.months[9]?.figure.amount).toBe(euros(0))
    const material = forecast.lines.find((entry) => entry.line === 'material-costs')
    // The month also holds the tool's plan row and the insurance already paid.
    expect(material?.forecast.months[10]?.bases).toEqual(['planned', 'paid-ahead', 'scheduled'])
    // 72,000.00 + 1,000.00 of revenue, the tool at 1,530.00 and the monitor at 400.00.
    expect(forecast.profitBeforeTax.total.amount).toBe(euros(56048))
  })

  it('lists the plan rows it does not count, with why', () => {
    expect(forecast.notModelled.map((entry) => (entry.line.kind === 'owner-pay-scenario' ? entry.line.scenario : entry.line.kind === 'amount' ? entry.line.item : 'purchase'))).toEqual([
      'revenue',
      'dividend',
      'owner-loan-out',
      'floor-salary',
    ])
    expect(forecast.notModelled[0]?.reason).toBe('Revenue is planned on the outgoing-plan tab, so the forecast reads it from there.')
  })
})

describe('forecastYear with a billing plan the invoices reach', () => {
  // A fee row for every invoice, each billed in full by its own month's invoice.
  const billed = STEADY_INVOICES.map((invoice) => planRow('Monthly fee', invoice.issued, invoice.amount / 100, 'example-client'))
  const octoberFee = planRow('Monthly fee', '2026-10-31', 6500, 'example-client')

  it('expects only the rows the invoices have not billed, from the first month after the last actual one', () => {
    const forecast = forecastYear(steadyStudio({ billingPlan: [...billed, planRow('Hotel', '2026-09-30', 300, 'example-client'), octoberFee] }), 2026, civil('2026-10-19'))

    // September's hotel is still open, but September's revenue comes from its invoice.
    expect(forecast.revenue.months[8]?.figure.amount).toBe(euros(6000))
    expect(bases(forecast.revenue).slice(9)).toEqual([['planned'], ['averaged'], ['averaged']])
    expect(forecast.revenue.months[9]?.figure.amount).toBe(euros(6500))
  })

  it('reads a month invoiced before the ledger closes it from its rows in full', () => {
    // October's invoice is issued on the 15th, so October is not an actual month yet and its invoice bills no row.
    const october = {
      ...(STEADY_INVOICES[STEADY_INVOICES.length - 1] as (typeof STEADY_INVOICES)[number]),
      number: '22-1',
      amount: euros(6500),
      issued: civil('2026-10-15'),
      id: recordIdOf(INVOICE_RECORDS, '22-1'),
    }
    const forecast = forecastYear(steadyStudio({ invoices: [...STEADY_INVOICES, october], billingPlan: [...billed, octoberFee] }), 2026, civil('2026-10-19'))

    expect(forecast.revenue.months[8]?.bases).toEqual(['actual'])
    expect(forecast.revenue.months[9]?.bases).toEqual(['planned'])
    expect(forecast.revenue.months[9]?.figure.amount).toBe(euros(6500))
  })
})

describe('forecastYear, a purchase above the threshold on the plan', () => {
  const forecast = forecastYear(steadyStudio({ planLines: [planPurchase('2026-11-15', 1600, 'computers', 'A second laptop')] }), 2026, civil('2026-10-19'))

  it('depreciates it from the month after it is put in use, as a planned asset row', () => {
    // 1,600.00 at 50% a year is 66.67 a month from December, beside the laptop's 100.00.
    expect(amounts(forecast.depreciation).slice(10)).toEqual([euros(100), euros(166.67)])
    expect(forecast.depreciation.total.amount).toBe(euros(566.67))
    expect(forecast.notModelled).toEqual([])
  })

  it('pays its net cost in its month', () => {
    const november = forecast.cashByMonth[10]?.closing.steps.find((step) => step.label === 'Planned purchases, at their net cost')
    expect(november?.amount).toBe(euros(-1600))
  })
})

describe('forecastYear before a month’s pay is in the ledger', () => {
  it('forecasts the last complete month of a cost paid in arrears until its payment arrives', () => {
    // On 7 October September's pay, due on the 10th, is not in the ledger yet.
    const forecast = forecastYear(steadyStudio(), 2026, civil('2026-10-07'))
    const pay = categoryLine(forecast, 'salary-net')

    expect(forecast.calendar.lastComplete).toBe('2026-09')
    expect(bases(pay).slice(7)).toEqual([['actual'], ['averaged'], ['averaged'], ['averaged'], ['averaged']])
    expect(pay.averagedOver).toEqual({ from: '2026-08', to: '2026-08', monthCount: 1 })
    expect(pay.months[8]?.figure.amount).toBe(euros(-1000))
    expect(bases(categoryLine(forecast, 'ai-services'))[8]).toEqual(['actual'])
  })
})

describe('forecastYear, a first tax period', () => {
  const forecast = forecastYear(steadyStudio({ yearEndLines: [] }), 2025, civil('2025-10-19'))

  it('averages over the complete months the young ledger has', () => {
    // The ledger starts on 5 January, so February is its first complete month.
    expect(forecast.revenue.averagedOver).toEqual({ from: '2025-02', to: '2025-09', monthCount: 8 })
    expect(forecast.revenue.total.amount).toBe(euros(60000))
  })

  it('pays no advances and leaves the whole liability as the balance due', () => {
    // Revenue 60,000.00 and the grant 1,000.00, less pay 12,000.00, payroll tax 2,400.00 and the
    // tool 1,440.00.
    expect(forecast.period.first).toBe(true)
    expect(forecast.taxBase.profitBeforeTax.amount).toBe(euros(45160))
    expect(forecast.liability.liability.amount).toBe(euros(4516))
    expect(forecast.cit.obligations).toEqual([])
    expect(forecast.liability.advancesPaid?.amount).toBe(euros(0))
    expect(forecast.cit.balanceDue?.expected.amount).toBe(euros(4516))
    expect(forecast.cit.balanceDue?.dueOn).toBe('2026-04-30')
  })

  it('starts the next year’s advances in April at the liability over the months of the period', () => {
    // Registered on 2 January, so the period touches twelve months: 4,516.00 / 12 = 376.33.
    const advances = forecast.cit.nextYear.obligations.filter((entry) => entry.kind === 'advance')
    expect(advances.map((entry) => entry.month)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
    expect(forecast.cit.newAdvance?.expected.amount).toBe(euros(376.33))
  })
})

describe('forecastYear, a year the ledger has closed', () => {
  const workbook = steadyStudio({ yearEndLines: [] })
  const forecast = forecastYear(workbook, 2025, civil('2026-10-19'))

  it('reads every month from the ledger and agrees with the accrual view', () => {
    const accrual = accrualYear(workbook, 2025, { depreciation: { depreciationDoubled: false }, citAdvancesPaid: null })

    expect(forecast.revenue.months.every((entry) => entry.bases.length === 1 && entry.bases[0] === 'actual')).toBe(true)
    expect(forecast.categories.every((entry) => entry.forecast.months.every((month) => month.bases[0] === 'actual'))).toBe(true)
    expect(forecast.profitBeforeTax.total.amount).toBe(accrual.bridge.profitBeforeTax.amount)
    expect(forecast.liability.liability.amount).toBe(accrual.liability.liability.amount)
    // Nine invoices of 5,000.00 and three of 6,000.00.
    expect(forecast.revenue.total.amount).toBe(euros(63000))
  })

  it('reads its cash at the year end from the balances', () => {
    expect(forecast.cashAtYearEnd.steps).toEqual([])
    expect(forecast.cashAtYearEnd.label).toBe('Cash at the end of 2025')
  })

  it('feeds the next year’s schedule from its own liability when the year-end tab has none', () => {
    const next = forecastYear(workbook, 2026, civil('2026-10-19'))
    const ownAdvance = Math.round(forecast.liability.liability.amount / 12)

    expect(next.cit.obligations.find((entry) => entry.obligation.kind === 'balance-due')?.obligation.expected.amount).toBe(forecast.liability.liability.amount)
    expect(next.cit.obligations.find((entry) => entry.obligation.month === '2026-04')?.obligation.expected.amount).toBe(ownAdvance)
  })
})

describe('forecastYear, a year the ledger has not reached', () => {
  it('averages every month and carries cash in from the year before’s forecast', () => {
    const workbook = steadyStudio()
    const forecast = forecastYear(workbook, 2027, civil('2026-10-19'))
    const before = forecastYear(workbook, 2026, civil('2026-10-19'))

    expect(bases(forecast.revenue).every((entry) => entry[0] === 'averaged')).toBe(true)
    expect(forecast.cashAtYearEnd.steps.slice(0, 3).map((step) => step.amount)).toEqual([before.cashAtYearEnd.amount, before.receivableAtYearEnd.amount, -before.decemberArrears.amount])
    // The 2026 forecast sets the 2027 advances from April.
    expect(forecast.cit.obligations.find((entry) => entry.obligation.month === '2027-04')?.obligation.expected.amount).toBe(before.liability.monthlyAdvance.amount)
  })

  it('keeps every obligation from the first tax period on, matched, beside the year’s own', () => {
    const forecast = forecastYear(steadyStudio(), 2027, civil('2026-10-19'))
    const own = forecast.cit.obligations.map((entry) => entry.obligation)
    const earlier = forecast.cit.history.filter((entry) => !own.includes(entry.obligation))
    const dueDates = forecast.cit.history.map((entry) => entry.obligation.dueOn)

    // The 2026 schedule: the 2025 balance and nine advances, of which the balance and April to August are paid.
    expect(earlier.map((entry) => entry.obligation.taxYear)).toEqual([2025, ...Array.from({ length: 9 }, () => 2026)])
    expect(earlier.map((entry) => entry.status)).toEqual(['paid', 'paid', 'paid', 'paid', 'paid', 'paid', 'due', 'to-come', 'to-come', 'to-come'])
    expect(own.every((obligation) => forecast.cit.history.some((entry) => entry.obligation === obligation))).toBe(true)
    expect(dueDates).toEqual([...dueDates].sort())
  })
})

describe('forecastYear without a registration day', () => {
  it('refuses, since the tax periods start from it', () => {
    const workbook = steadyStudio()
    const unregistered = { ...workbook, companyFacts: { ...workbook.companyFacts, companyRegistered: null } }

    expect(() => forecastYear(unregistered, 2026, civil('2026-10-19'))).toThrow('hr_company_registered')
  })
})
