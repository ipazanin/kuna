import { describe, expect, it } from 'vitest'

import type { CompanyFacts } from '../src/packs/hr-doo/domain/companyFacts'
import { citLiability } from '../src/packs/hr-doo/domain/cit/citLiability'
import { citSchedule } from '../src/packs/hr-doo/domain/cit/citSchedule'
import type { CitSchedule } from '../src/packs/hr-doo/domain/cit/citSchedule'
import { closedYearReturn } from '../src/packs/hr-doo/domain/cit/priorReturn'
import type { PriorReturn } from '../src/packs/hr-doo/domain/cit/priorReturn'
import { taxBase } from '../src/packs/hr-doo/domain/cit/taxBase'
import { tracedFigure } from '../src/packs/hr-doo/domain/payroll/payrollArithmetic'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { yearEndLine } from './fixtures/exampleStudio'
import { civil, euros } from './fixtures/ledger'
import { COMPANY_FACT_SETTINGS } from '../src/packs/hr-doo/domain/companyFacts'

const REGISTERED = civil('2025-06-16')

function facts(registered: CivilDate | null = REGISTERED): CompanyFacts {
  return { ...COMPANY_FACT_SETTINGS.defaults, companyRegistered: registered }
}

/** The accountant's 2025 return: a first period of seven months with 1,400.00 of tax and no advances. */
function closed2025(monthsOfOperation: number | null = 7, monthlyAdvance: number | null = null): PriorReturn {
  const lines = [
    yearEndLine(2025, 'tax', 'liability', 1400),
    yearEndLine(2025, 'tax', 'balance-due', 1400),
    ...(monthsOfOperation === null ? [] : [yearEndLine(2025, 'tax', 'months-of-operation', { kind: 'count', count: monthsOfOperation })]),
    ...(monthlyAdvance === null ? [] : [yearEndLine(2025, 'tax', 'monthly-advance', monthlyAdvance)]),
  ]
  const filed = closedYearReturn(lines, 2025, REGISTERED)
  if (filed === null) {
    throw new Error('The 2025 return was not read.')
  }
  return filed
}

function figure(amount: number) {
  return tracedFigure('Example', euros(amount), 'ledger', [])
}

/** Our own 2026 liability: 10% of a profit of ten times it, a full year. */
function ours2026(liability: number, advancesPaid: number | null) {
  const base = taxBase({
    year: 2026,
    revenue: figure(liability * 10 + 20000),
    expenses: figure(20000),
    representation: figure(0),
    personalTransport: figure(0),
    nonDeductible: figure(0),
    depreciationAboveAllowed: figure(0),
    relatedPartyInterestShortfall: figure(0),
    lossesBroughtForward: [],
  })
  return citLiability(base, { from: civil('2026-01-01'), to: civil('2026-12-31'), first: false }, advancesPaid === null ? null : figure(advancesPaid))
}

function advances(schedule: CitSchedule) {
  return schedule.obligations.filter((obligation) => obligation.kind === 'advance').map((obligation) => [obligation.month, obligation.dueOn, obligation.expected.amount])
}

function balance(schedule: CitSchedule) {
  return schedule.obligations.find((obligation) => obligation.kind === 'balance-due') ?? null
}

describe('citSchedule', () => {
  it('pays no advances and no balance in a first period', () => {
    const schedule = citSchedule(2025, [], facts())

    expect(schedule.obligations).toEqual([])
    expect(schedule.advances.amount).toBe(euros(0))
  })

  it('starts the year after a first period at April, with the first return due by 30 April', () => {
    const schedule = citSchedule(2026, [closed2025()], facts())

    expect(balance(schedule)).toMatchObject({ taxYear: 2025, month: null, dueOn: civil('2026-04-30') })
    expect(balance(schedule)?.expected.amount).toBe(euros(1400))
    // 1,400.00 over the seven months of 2025 is 200.00, nine times from April.
    expect(advances(schedule)).toEqual([
      ['2026-04', civil('2026-05-31'), euros(200)],
      ['2026-05', civil('2026-06-30'), euros(200)],
      ['2026-06', civil('2026-07-31'), euros(200)],
      ['2026-07', civil('2026-08-31'), euros(200)],
      ['2026-08', civil('2026-09-30'), euros(200)],
      ['2026-09', civil('2026-10-31'), euros(200)],
      ['2026-10', civil('2026-11-30'), euros(200)],
      ['2026-11', civil('2026-12-31'), euros(200)],
      ['2026-12', civil('2027-01-31'), euros(200)],
    ])
    expect(schedule.advances.amount).toBe(euros(1800))
    expect(schedule.obligations.every((obligation) => obligation.expected.rules.length > 0)).toBe(true)
  })

  it('divides by the months of operation the year-end tab gives, else by the months the period touches', () => {
    // 1,400.00 over 8 months is 175.00. Without the line, June to December is 7 months.
    expect(advances(citSchedule(2026, [closed2025(8)], facts()))[0]?.[2]).toBe(euros(175))
    expect(advances(citSchedule(2026, [closed2025(null)], facts()))[0]?.[2]).toBe(euros(200))
  })

  it('takes the advance from PD line 59 as the accountant filed it, over the division', () => {
    const [first] = citSchedule(2026, [closed2025(7, 210)], facts()).obligations.filter((obligation) => obligation.kind === 'advance')

    expect(first?.expected.amount).toBe(euros(210))
    expect(first?.expected.basis).toBe('accountant')
    expect(first?.expected.rules.map((rule) => rule.ruleId)).toContain('hr.cit.monthly-advance')
  })

  it('keeps the advance of the return before last until April, then takes the new one', () => {
    // Our 2026 liability of 3,000.00 over twelve months is 250.00.
    const schedule = citSchedule(2027, [closed2025(), ours2026(3000, 1800)], facts())
    const amounts = advances(schedule).map(([month, , amount]) => [month, amount])

    expect(amounts.slice(0, 4)).toEqual([
      ['2027-01', euros(200)],
      ['2027-02', euros(200)],
      ['2027-03', euros(200)],
      ['2027-04', euros(250)],
    ])
    expect(amounts).toHaveLength(12)
    expect(schedule.advances.amount).toBe(euros(3 * 200 + 9 * 250))
  })

  it('takes the balance from the advances paid when known, else from the advances expected', () => {
    // 3,000.00 less 1,600.00 paid, one advance short of the 1,800.00 expected.
    expect(balance(citSchedule(2027, [closed2025(), ours2026(3000, 1600)], facts()))?.expected.amount).toBe(euros(1400))
    expect(balance(citSchedule(2027, [closed2025(), ours2026(3000, null)], facts()))?.expected.amount).toBe(euros(1200))
    expect(balance(citSchedule(2027, [closed2025(), ours2026(3000, null)], facts()))?.dueOn).toBe(civil('2027-04-30'))
  })

  it('owes no balance when the advances cover the liability, and no advance after a year with no tax', () => {
    expect(balance(citSchedule(2027, [closed2025(), ours2026(1000, null)], facts()))).toBeNull()
    expect(advances(citSchedule(2027, [closed2025(), ours2026(0, null)], facts())).map(([month]) => month)).toEqual(['2027-01', '2027-02', '2027-03'])
  })

  it('asks for a return it needs and refuses a year before the company', () => {
    expect(() => citSchedule(2027, [closed2025()], facts())).toThrow('needs the return for 2026')
    expect(() => citSchedule(2026, [], facts(null))).toThrow('needs the return for')
    expect(() => citSchedule(2024, [], facts())).toThrow('registered on 2025-06-16')
  })
})
