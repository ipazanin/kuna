import { describe, expect, it } from 'vitest'

import type { Category } from '../src/features/workbook/domain/workbook'
import { citLiability } from '../src/packs/hr-doo/domain/cit/citLiability'
import { citSchedule } from '../src/packs/hr-doo/domain/cit/citSchedule'
import { matchCitPayments } from '../src/packs/hr-doo/domain/cit/matchCitPayments'
import type { CitPaymentMatching } from '../src/packs/hr-doo/domain/cit/matchCitPayments'
import { closedYearReturn } from '../src/packs/hr-doo/domain/cit/priorReturn'
import type { PriorReturn } from '../src/packs/hr-doo/domain/cit/priorReturn'
import { taxBase } from '../src/packs/hr-doo/domain/cit/taxBase'
import { tracedFigure } from '../src/packs/hr-doo/domain/payroll/payrollArithmetic'
import { yearEndLine } from './fixtures/exampleStudio'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { COMPANY_FACT_SETTINGS } from '../src/packs/hr-doo/domain/companyFacts'
import { BUCKET_COLOUR } from '../src/features/workbook/domain/categoryColour'

const FACTS = { ...COMPANY_FACT_SETTINGS.defaults, companyRegistered: civil('2025-06-16') }

const CATEGORIES: readonly Category[] = [
  { slug: 'profit-tax', family: 'taxes', bucket: 'taxes', colour: BUCKET_COLOUR, roles: ['corporate-income-tax'], vat: 'none' },
  { slug: 'payroll-tax', family: 'taxes', bucket: 'taxes', colour: BUCKET_COLOUR, roles: [], vat: 'none' },
]

const CODE = 'Corporate tax, revenue code 1651'

/** 1,400.00 of tax for a first period of seven months: the 2026 advance is 200.00. */
function closed2025(): PriorReturn {
  const filed = closedYearReturn(
    [yearEndLine(2025, 'tax', 'liability', 1400), yearEndLine(2025, 'tax', 'months-of-operation', { kind: 'count', count: 7 })],
    2025,
    FACTS.companyRegistered,
  )
  if (filed === null) {
    throw new Error('The 2025 return was not read.')
  }
  return filed
}

/** A full 2026 with 2,400.00 of tax, so the 2027 advance from April is 200.00 too. */
function ours2026() {
  const figure = (amount: number) => tracedFigure('Example', euros(amount), 'ledger', [])
  const base = taxBase({
    year: 2026,
    revenue: figure(44000),
    expenses: figure(20000),
    representation: figure(0),
    personalTransport: figure(0),
    nonDeductible: figure(0),
    depreciationAboveAllowed: figure(0),
    relatedPartyInterestShortfall: figure(0),
    lossesBroughtForward: [],
  })
  return citLiability(base, { from: civil('2026-01-01'), to: civil('2026-12-31'), first: false }, null)
}

const SCHEDULES = [citSchedule(2025, [], FACTS), citSchedule(2026, [closed2025()], FACTS)]

function paid(date: string, amount: number): RowSpec {
  return { date, amount: -amount, category: 'profit-tax', description: CODE }
}

function statuses(matching: CitPaymentMatching) {
  return matching.obligations.map((entry) => [entry.obligation.month ?? `balance ${entry.obligation.taxYear}`, entry.status])
}

function advancesPaidFor(matching: CitPaymentMatching, year: number) {
  return matching.advancesPaid.find((entry) => entry.year === year)?.paid.amount
}

describe('matchCitPayments', () => {
  it('tells the balance from the advances by due date, as both carry one payment code', () => {
    const rows = ledger([
      paid('2026-04-29', 1400),
      { date: '2026-05-10', amount: -90, category: 'payroll-tax', description: CODE },
      paid('2026-05-29', 200),
      paid('2026-06-29', 200),
      paid('2026-07-30', 200),
      paid('2026-08-28', 200),
      paid('2026-09-29', 200),
    ])
    const matching = matchCitPayments(SCHEDULES, rows, CATEGORIES, civil('2026-10-19'))

    expect(statuses(matching)).toEqual([
      ['balance 2025', 'paid'],
      ['2026-04', 'paid'],
      ['2026-05', 'paid'],
      ['2026-06', 'paid'],
      ['2026-07', 'paid'],
      ['2026-08', 'paid'],
      ['2026-09', 'due'],
      ['2026-10', 'to-come'],
      ['2026-11', 'to-come'],
      ['2026-12', 'to-come'],
    ])
    const settlement = matching.obligations[0]
    expect(settlement?.paid.amount).toBe(euros(1400))
    expect(settlement?.paid.drill?.filters).toEqual({
      period: { preset: 'custom', range: { from: civil('2026-04-29'), to: civil('2026-04-29') } },
      categories: ['profit-tax'],
      amount: { min: euros(-1400), max: euros(-1400) },
    })
    expect(settlement?.paid.rules.map((rule) => rule.ruleId)).toContain('hr.cit.balance-due')
    // Five advances, April to August, for PD line 56 of 2026. A first period has none.
    expect(advancesPaidFor(matching, 2026)).toBe(euros(1000))
    expect(advancesPaidFor(matching, 2025)).toBe(euros(0))
    expect(matching.unmatched).toEqual([])
  })

  it('fills the oldest obligation first, so a missed advance shows as the latest one overdue', () => {
    const rows = ledger([paid('2026-04-29', 1400), paid('2026-05-29', 200), paid('2026-07-30', 200), paid('2026-08-28', 200), paid('2026-09-29', 200)])
    const matching = matchCitPayments(SCHEDULES, rows, CATEGORIES, civil('2026-10-19'))

    expect(statuses(matching).slice(1, 7)).toEqual([
      ['2026-04', 'paid'],
      ['2026-05', 'paid'],
      ['2026-06', 'paid'],
      ['2026-07', 'paid'],
      ['2026-08', 'overdue'],
      ['2026-09', 'due'],
    ])
    expect(matching.obligations[5]?.outstanding).toBe(euros(200))
  })

  it('counts the December advance paid in January for the year it covers', () => {
    const schedules = [...SCHEDULES, citSchedule(2027, [closed2025(), ours2026()], FACTS)]
    const months = ['05', '06', '07', '08', '09', '10', '11', '12']
    const rows = ledger([paid('2026-04-29', 1400), ...months.map((month) => paid(`2026-${month}-28`, 200)), paid('2027-01-29', 200)])
    const matching = matchCitPayments(schedules, rows, CATEGORIES, civil('2027-02-03'))

    const december = matching.obligations.find((entry) => entry.obligation.month === '2026-12')
    expect(december).toMatchObject({ status: 'paid', obligation: { taxYear: 2026, dueOn: civil('2027-01-31') } })
    expect(advancesPaidFor(matching, 2026)).toBe(euros(1800))
    expect(advancesPaidFor(matching, 2027)).toBe(euros(0))
    expect(matching.obligations.find((entry) => entry.obligation.month === '2027-01')?.status).toBe('due')
  })

  it('splits a payment over the obligations it reaches, and lists what none took and any refund', () => {
    const rows = ledger([paid('2026-04-29', 1300), paid('2026-05-29', 300), paid('2026-12-20', 1700), { date: '2027-01-15', amount: 50, category: 'profit-tax' }])
    const matching = matchCitPayments(SCHEDULES, rows, CATEGORIES, civil('2026-05-15'))

    // 1,300.00 leaves 100.00 of the balance, which the 300.00 settles before 200.00 of April.
    const [settlement, april] = matching.obligations
    expect(settlement?.paid.steps.map((step) => step.amount)).toEqual([euros(1300), euros(100)])
    expect(settlement?.paid.drill?.filters.period).toEqual({ preset: 'custom', range: { from: civil('2026-04-29'), to: civil('2026-05-29') } })
    expect(april?.paid.amount).toBe(euros(200))
    // 3,300.00 paid against 3,200.00 owed leaves 100.00, and the refund reads negative.
    expect(matching.unmatched.map((entry) => entry.amount)).toEqual([euros(100), euros(-50)])
  })

  it('marks an obligation overdue after its due date while any of it is open', () => {
    const matching = matchCitPayments(SCHEDULES, ledger([paid('2026-04-29', 1300)]), CATEGORIES, civil('2026-05-01'))

    expect(matching.obligations[0]).toMatchObject({ status: 'overdue', outstanding: euros(100) })
    // April's advance falls due on 31 May, in the month matched on, and May's in June.
    expect(matching.obligations[1]?.status).toBe('due')
    expect(matching.obligations[2]?.status).toBe('to-come')
  })
})
