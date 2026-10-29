import { describe, expect, it } from 'vitest'

import type { Period } from '../src/apps/company/filters/domain/filterState'
import { monthKey } from '../src/shared/calendar/monthKey'
import type { LedgerWindow } from '../src/shared/calendar/ledgerWindow'
import { ledgerWindowOf } from '../src/apps/company/workbook/domain/workbook'
import { COMPANY_FACT_SETTINGS } from '../src/apps/company/packs/hr-doo/domain/companyFacts'
import type { TracedRate } from '../src/apps/company/packs/hr-doo/domain/cit/citLiability'
import type { ForecastLine } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastLines'
import { forecastYear } from '../src/apps/company/packs/hr-doo/domain/forecast/forecastYear'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { ownerNetWithProfit } from '../src/apps/company/packs/hr-doo/domain/ownerNetWithProfit'
import type { OwnerNetWithProfit } from '../src/apps/company/packs/hr-doo/domain/ownerNetWithProfit'
import { ownerTake } from '../src/apps/company/packs/hr-doo/domain/ownerTake'
import { summed, tracedFigure } from '../src/apps/company/packs/hr-doo/domain/payroll/payrollArithmetic'
import type { Rate } from '../src/apps/company/packs/hr-doo/ruleset/schema'
import { ownerNetDetail } from '../src/apps/company/packs/hr-doo/presentation/ownerNetDetail'
import { RENT_TAX_LABEL } from '../src/apps/company/packs/hr-doo/presentation/packCharts'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, windowOf } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { STEADY_CATEGORIES, steadyStudio } from './fixtures/steadyStudio'

const rateOf = (percent: number): TracedRate => ({ label: 'PD line 43', basisPoints: (percent * 100) as Rate, rules: [] })

/** A year's profit before tax, the given euros in each month it names and nothing in the others. */
function profitLine(year: number, euroByMonth: (month: number) => number): ForecastLine {
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = monthKey(year, index + 1)
    return { month, bases: ['actual' as const], figure: tracedFigure(`Profit before tax, ${month}`, euros(euroByMonth(index + 1)), 'ledger', []), soFar: null, plan: null }
  })
  return {
    label: 'Profit before tax',
    months,
    total: summed(
      'Profit before tax',
      months.map((entry) => entry.figure),
      'ledger',
    ),
    averagedOver: null,
    average: null,
  }
}

function booksOf(rows: readonly RowSpec[], registered: string | null = '2025-01-02'): HrDooWorkbook {
  return steadyStudio({
    transactions: withPackBuckets(ledger(rows), STEADY_CATEGORIES),
    ownerAdvances: [],
    companyFacts: { ...COMPANY_FACT_SETTINGS.defaults, companyRegistered: registered === null ? null : civil(registered) },
  })
}

function days(from: string, to: string): Period {
  return { preset: 'custom', range: { from: civil(from), to: civil(to) } }
}

function netOf(books: HrDooWorkbook, period: Period, window: LedgerWindow, newest: string, profit: (year: number) => ForecastLine, rate: (year: number) => TracedRate = () => rateOf(10)) {
  const take = ownerTake(books.transactions, books.categories, period, window)
  return ownerNetWithProfit(take, books, period, window, civil(newest), { profitBeforeTax: profit, corporateRate: rate })
}

function ready(net: ReturnType<typeof netOf>): OwnerNetWithProfit {
  if (net === null || net.state !== 'ready') {
    throw new Error(`expected figures, got ${JSON.stringify(net)}`)
  }
  return net
}

const noForecast = (year: number): never => {
  throw new Error(`the forecast of ${year} was read`)
}

// The design's worked example, made-up figures: a 6,000 salary from January to June 2026, 30,000
// of profit before tax over those months and a May dividend of 8,800 net out of 2025's profit.
const SALARY: readonly RowSpec[] = [1, 2, 3, 4, 5, 6].map((month) => ({ date: `2026-0${month}-10`, amount: -1000, category: 'salary-net' }))
const WORKED: readonly RowSpec[] = [
  { date: '2025-05-01', amount: 100, category: 'revenue' },
  ...SALARY,
  { date: '2026-05-18', amount: -8800, category: 'dividend' },
  { date: '2026-05-18', amount: -1200, category: 'dividend-tax' },
  { date: '2026-07-03', amount: 100, category: 'revenue' },
]
const WORKED_WINDOW = windowOf('2025-05-01', '2026-07-03')
const WORKED_PROFIT = (year: number) => (year === 2026 ? profitLine(2026, () => 5000) : profitLine(2025, (month) => (month >= 5 ? 1562.5 : 0)))
const JANUARY_TO_JUNE = days('2026-01-01', '2026-06-30')

describe('ownerNetWithProfit on the worked example', () => {
  const net = ready(netOf(booksOf(WORKED), JANUARY_TO_JUNE, WORKED_WINDOW, '2026-07-03', WORKED_PROFIT))

  it('counts the pay without the dividend and the profit after both taxes, each a month', () => {
    expect(net.pay.amount).toBe(euros(6000))
    expect(net.dividendsLeftOut.amount).toBe(euros(8800))
    expect(net.payMonths).toBe(6)
    expect(net.profitMonths).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'])
    // 30,000 less 10% corporate tax is 27,000, less 12% dividend tax of 3,240 is 23,760.
    expect(net.years.map(({ amount, route }) => [amount.amount, route.corporateTax.amount, route.dividendTax.amount])).toEqual([[euros(30000), euros(3000), euros(3240)]])
    expect(net.profit.amount).toBe(euros(23760))
    expect([net.payPerMonth, net.profitPerMonth, net.perMonth]).toEqual([euros(1000), euros(3960), euros(4960)])
  })

  it('leaves the 2026 profit in the company, since the May dividend paid out 2025', () => {
    expect(net.paidOut).toBe(euros(0))
    expect(net.leftInCompany).toBe(euros(23760))
  })

  it('counts the May dividend against 2025, which keeps the net of what is still retained', () => {
    const year2025 = ready(netOf(booksOf(WORKED), { preset: 'year', year: 2025 }, WORKED_WINDOW, '2026-07-03', WORKED_PROFIT))

    // 12,500 less 1,250 corporate tax less 1,350 dividend tax is 9,900, of which the dividend took 8,800.
    expect(year2025.profit.amount).toBe(euros(9900))
    expect(year2025.paidOut).toBe(euros(8800))
    expect(year2025.leftInCompany).toBe(euros(1100))
    expect(year2025.years[0]?.paidOut.drill.filters).toEqual({ period: { preset: 'year', year: 2026 }, categories: ['dividend'] })
  })

  it('shows an open owner loan as what a payout sets off, and leaves the total as it was', () => {
    const lent = ready(netOf(booksOf([...WORKED, { date: '2026-03-15', amount: -2000, category: 'owner-loan-out' }]), JANUARY_TO_JUNE, WORKED_WINDOW, '2026-07-03', WORKED_PROFIT))

    expect(lent.owed.amount).toBe(euros(2000))
    expect(lent.owed.on).toBe(civil('2026-06-30'))
    expect(lent.setsOff).toBe(euros(2000))
    expect(lent.perMonth).toBe(net.perMonth)
    expect(net.owed.amount).toBe(euros(0))
    expect(net.setsOff).toBe(euros(0))

    const lines = ownerNetDetail(lent, 'Jan 2026 – Jun 2026', () => null).steps.map((step) => [step.label, step.cents])
    expect(lines).toContainEqual(['Of it, sets off what the owner owes on 30 Jun 2026', euros(2000)])
    expect(lines).toContainEqual(['Profit before tax, Jan 2026 – Jun 2026', euros(30000)])
    expect(lines).toContainEqual(['Dividends left out, since the profit counts them', euros(8800)])
  })
})

describe('ownerNetWithProfit with rent', () => {
  it('counts the rent after the rent tax and shows the step in the build-up', () => {
    const categories = [...STEADY_CATEGORIES, ...PACK_CATEGORIES.filter((category) => category.slug === 'rent-owner')]
    const rent: RowSpec[] = [1, 2, 3, 4, 5, 6].map((month) => ({ date: `2026-0${month}-10`, amount: -300, category: 'rent-owner' }))
    const books = steadyStudio({
      categories,
      transactions: withPackBuckets(ledger([...WORKED, ...rent]), categories),
      ownerAdvances: [],
      companyFacts: { ...COMPANY_FACT_SETTINGS.defaults, companyRegistered: civil('2025-01-02') },
    })
    const net = ready(netOf(books, JANUARY_TO_JUNE, WORKED_WINDOW, '2026-07-03', WORKED_PROFIT))

    // Six rents of 300.00, each 25.20 of rent tax, leave 6,000 of salary and 1,648.80 of rent.
    expect(net.rentTax.amount).toBe(euros(151.2))
    expect(net.pay.amount).toBe(euros(7648.8))
    expect(net.payPerMonth).toBe(euros(1274.8))
    const lines = ownerNetDetail(net, 'Jan 2026 – Jun 2026', () => null).steps.map((step) => [step.label, step.cents, step.depth])
    expect(lines.slice(0, 4)).toEqual([
      ['Pay without loans and dividends, 6 months', euros(7800), 0],
      ['Dividends left out, since the profit counts them', euros(8800), 1],
      [RENT_TAX_LABEL, euros(-151.2), 1],
      ['Pay after the rent tax', euros(7648.8), 0],
    ])
  })
})

describe('ownerNetWithProfit', () => {
  it('takes a loss through the same taxes', () => {
    const rows: RowSpec[] = [{ date: '2026-01-01', amount: 100, category: 'revenue' }, ...SALARY.slice(0, 3), { date: '2026-04-03', amount: 100, category: 'revenue' }]
    const net = ready(netOf(booksOf(rows), { preset: 'quarter', year: 2026, quarter: 1 }, windowOf('2026-01-01', '2026-04-03'), '2026-04-03', () => profitLine(2026, () => -2000)))

    // A 6,000 loss less 600 corporate tax is 5,400, less 648 dividend tax is 4,752.
    expect(net.profit.amount).toBe(euros(-4752))
    expect(net.profitPerMonth).toBe(euros(-1584))
    expect(net.perMonth).toBe(euros(1000 - 1584))
    expect(net.paidOut).toBe(euros(0))
    expect(net.setsOff).toBe(euros(0))
  })

  it('reads pay alone when the period holds no complete month, and never asks for a forecast', () => {
    const rows: RowSpec[] = [
      { date: '2026-06-01', amount: 100, category: 'revenue' },
      { date: '2026-07-10', amount: -1200, category: 'salary-net' },
      { date: '2026-07-20', amount: 100, category: 'revenue' },
    ]
    const net = ready(netOf(booksOf(rows), { preset: 'quarter', year: 2026, quarter: 3 }, windowOf('2026-06-01', '2026-07-20'), '2026-07-20', noForecast, noForecast))

    expect(net.payMonths).toBe(1)
    expect(net.profitMonths).toEqual([])
    expect(net.profit.amount).toBe(euros(0))
    expect(net.perMonth).toBe(euros(1200))
    expect(ownerNetDetail(net, 'Jul 2026 so far', () => null).steps.map((step) => step.label)).toContain('No complete month of profit yet')
  })

  it('taxes each year of a period across two years at its own corporate rate', () => {
    const rows: RowSpec[] = [
      { date: '2025-10-01', amount: 100, category: 'revenue' },
      { date: '2026-03-05', amount: 100, category: 'revenue' },
    ]
    const profit = (year: number) => profitLine(year, (month) => (year === 2025 ? (month >= 11 ? 1000 : 0) : month <= 2 ? 1000 : 0))
    const net = ready(netOf(booksOf(rows), days('2025-11-01', '2026-02-28'), windowOf('2025-10-01', '2026-03-05'), '2026-03-05', profit, (year) => rateOf(year === 2025 ? 18 : 10)))

    // 2025: 2,000 less 360 at 18% is 1,640, less 196.80 dividend tax is 1,443.20.
    // 2026: 2,000 less 200 at 10% is 1,800, less 216.00 dividend tax is 1,584.00.
    expect(net.years.map(({ year, months, route }) => [year, months, route.corporateTax.label, route.net.amount])).toEqual([
      [2025, ['2025-11', '2025-12'], 'Corporate tax at 18%', euros(1443.2)],
      [2026, ['2026-01', '2026-02'], 'Corporate tax at 10%', euros(1584)],
    ])
    expect(net.profit.amount).toBe(euros(3027.2))
    expect(net.profitPerMonth).toBe(euros(756.8))
  })

  it('covers every complete month on all time, and no year before the company was registered', () => {
    const rows: RowSpec[] = [
      { date: '2024-11-14', amount: 100, category: 'revenue' },
      { date: '2026-04-10', amount: 100, category: 'revenue' },
    ]
    const profit = (year: number) => (year < 2025 ? noForecast(year) : profitLine(year, () => 1000))
    const net = ready(netOf(booksOf(rows), { preset: 'all' }, windowOf('2024-11-14', '2026-04-10'), '2026-04-10', profit))

    expect(net.payMonths).toBe(18)
    expect(net.profitMonths[0]).toBe('2025-01')
    expect(net.profitMonths[net.profitMonths.length - 1]).toBe('2026-03')
    expect(net.years.map(({ year, amount }) => [year, amount.amount])).toEqual([
      [2025, euros(12000)],
      [2026, euros(3000)],
    ])
  })

  it('counts the ledger’s first part month in profit, as Year does, and never the month so far', () => {
    const rows: RowSpec[] = [
      { date: '2025-05-12', amount: 100, category: 'revenue' },
      { date: '2025-08-04', amount: 100, category: 'revenue' },
    ]
    const net = ready(netOf(booksOf(rows, '2025-05-12'), { preset: 'year', year: 2025 }, windowOf('2025-05-12', '2025-08-04'), '2025-08-04', () => profitLine(2025, () => 1000)))

    expect(net.payMonths).toBe(4)
    expect(net.profitMonths).toEqual(['2025-05', '2025-06', '2025-07'])
  })

  it('needs the day the company was registered before it reads any forecast', () => {
    expect(netOf(booksOf(WORKED, null), JANUARY_TO_JUNE, WORKED_WINDOW, '2026-07-03', noForecast, noForecast)).toEqual({ state: 'unregistered' })
  })

  it('is null when the period holds no month of the ledger', () => {
    expect(netOf(booksOf(WORKED), { preset: 'year', year: 2024 }, WORKED_WINDOW, '2026-07-03', noForecast, noForecast)).toBeNull()
  })

  it('reads the profit of each month from Year’s forecast, its year total on Year', () => {
    const books = steadyStudio()
    const window = ledgerWindowOf(books.transactions)!
    const forecast = forecastYear(books, 2025, civil('2026-10-10'))
    const net = ready(
      netOf(
        books,
        { preset: 'year', year: 2025 },
        window,
        '2026-10-10',
        (year) => forecastYear(books, year, civil('2026-10-10')).profitBeforeTax,
        () => forecast.liability.rate,
      ),
    )

    expect(net.profitMonths).toHaveLength(12)
    expect(net.years[0]?.amount.amount).toBe(forecast.profitBeforeTax.total.amount)
  })
})
