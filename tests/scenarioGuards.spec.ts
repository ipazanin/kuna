import { describe, expect, it } from 'vitest'

import type { OwnerPayScenario, ScenarioComponent } from '../src/features/workbook/domain/ownerPayScenarios'
import { scenarioGuards } from '../src/packs/hr-doo/domain/scenarios/scenarioGuards'
import { civil, euros } from './fixtures/ledger'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { SCENARIO_RECORDS } from '../src/features/workbook/domain/recordKind'

type Row = ScenarioComponent extends infer Each ? (Each extends ScenarioComponent ? Omit<Each, 'id' | 'from' | 'to'> & { from?: string; to?: string } : never) : never

function reasons(rows: readonly Row[], year = 2027): string[] {
  const components = rows.map((row, index) => ({ ...row, from: row.from === undefined ? null : civil(row.from), to: row.to === undefined ? null : civil(row.to), id: recordIdOf(SCENARIO_RECORDS, `row-${index + 2}`) }) as ScenarioComponent)
  const scenario: OwnerPayScenario = { slug: 'mix', label: '', year, components }
  return scenarioGuards(scenario).map((guard) => guard.reason)
}

const FLOOR: Row = { component: 'salary_gross', gross: 'floor' }

describe('scenarioGuards', () => {
  it('passes the starting scenarios as the app writes them', () => {
    expect(reasons([{ ...FLOOR, to: '2027-06-04' }, { component: 'director_basis', basis: 'board-only', from: '2027-06-05' }, { component: 'dividend', amount: 'max' }])).toEqual([])
    expect(reasons([FLOOR, { component: 'nontaxable', item: 'occasional-gift', amount: euros(700) }, { component: 'rent_monthly', amount: euros(250) }])).toEqual([])
  })

  it('refuses two rows of one component on the same day', () => {
    expect(reasons([FLOOR, { component: 'salary_gross', gross: euros(2000), from: '2027-07-01' }])).toEqual(['The floor salary and the salary of 2000.00 from 2027-07-01 both set the salary on 2027-07-01.'])
    expect(
      reasons([
        { component: 'rent_monthly', amount: euros(250), to: '2027-03-31' },
        { component: 'rent_monthly', amount: euros(300), from: '2027-03-31' },
      ]),
    ).toEqual(['The rent of 250.00 to 2027-03-31 and the rent of 300.00 from 2027-03-31 both set the rent on 2027-03-31.'])
  })

  it('refuses two salaries in one month', () => {
    expect(reasons([{ ...FLOOR, to: '2027-06-15' }, { component: 'salary_gross', gross: euros(2000), from: '2027-06-16' }])).toEqual([
      'The floor salary to 2027-06-15 and the salary of 2000.00 from 2027-06-16 both pay a salary in 2027-06. A salary can change only from the first of a month.',
    ])
  })

  it('refuses a second dividend', () => {
    expect(reasons([FLOOR, { component: 'dividend', amount: 'max' }, { component: 'dividend', amount: euros(1000) }])).toEqual([
      "The scenario sets 2 dividends. A scenario pays one, out of the year's profit.",
    ])
  })

  it('refuses an insurance basis the salary contradicts', () => {
    expect(reasons([FLOOR, { component: 'director_basis', basis: 'board-only', from: '2027-11-01' }])).toEqual([
      'The board-only director basis from 2027-11-01 holds on 2027-11-01, a day the floor salary pays. A director paid a salary is insured as an employee.',
    ])
    expect(reasons([{ ...FLOOR, to: '2027-06-30' }, { component: 'director_basis', basis: 'employee' }])).toEqual([
      'The employee director basis makes the director an employee on 2027-07-01, a day no salary row covers. Add the salary, or end the row earlier.',
    ])
  })

  it('refuses a tax-free item the ruleset does not cap by the year', () => {
    const yearly = 'Use one with a yearly cap: results-bonus, occasional-gift, child-gift, holiday-services, meal-allowance-flat, meals-on-invoices, supplementary-health-insurance.'
    expect(reasons([FLOOR, { component: 'nontaxable', item: 'gifts', amount: euros(700) }])).toEqual([`The item gifts is not a tax-free payment the ruleset lists for 2027. ${yearly}`])
    expect(reasons([FLOOR, { component: 'nontaxable', item: 'work-at-separate-place', amount: euros(500) }])).toEqual([
      `The item work-at-separate-place has no yearly cap to check a year's amount against. ${yearly}`,
    ])
    expect(reasons([FLOOR, { component: 'nontaxable', item: 'living-apart-from-family', amount: euros(300) }])).toEqual([
      `The item living-apart-from-family has no yearly cap to check a year's amount against. ${yearly}`,
    ])
  })

  it('refuses a tax-free item paid in a month with no salary', () => {
    expect(reasons([{ ...FLOOR, to: '2027-06-30' }, { component: 'nontaxable', item: 'occasional-gift', amount: euros(700), from: '2027-12-01' }])).toEqual([
      'The item occasional-gift is paid in 2027-12, a month with no salary. A tax-free payment goes only to an employee.',
    ])
  })
})
