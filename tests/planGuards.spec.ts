import { describe, expect, it } from 'vitest'

import type { OwnerPayScenario, ScenarioComponent } from '../src/apps/company/packs/hr-doo/domain/scenarios/ownerPayScenarios'
import type { ComponentDraft } from '../src/apps/company/packs/hr-doo/domain/scenarios/startingScenarios'
import { ownerPayPlan, planGuards } from '../src/apps/company/packs/hr-doo/domain/forecast/planGuards'
import { switchedScenario } from '../src/apps/company/packs/hr-doo/domain/scenarios/switchedScenario'
import { civil, euros } from './fixtures/ledger'
import { planLine, planOwnerPay } from './fixtures/steadyStudio'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { PLAN_RECORDS, SCENARIO_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'

/** A scenario, each component's id made from its scenario and place. */
function scenario(slug: string, year: number, components: readonly ComponentDraft[]): OwnerPayScenario {
  return { slug, label: '', year, components: components.map((component, index) => ({ ...component, id: recordIdOf(SCENARIO_RECORDS, `${slug}-${index}`) }) as ScenarioComponent) }
}

const FLOOR = scenario('floor', 2027, [
  { component: 'salary_gross', gross: 'floor', from: null, to: null },
  { component: 'nontaxable', item: 'occasional-gift', amount: euros(133), from: civil('2027-12-01'), to: null },
  { component: 'dividend', amount: 'max', from: null, to: null },
])
const BOARD = scenario('board', 2027, [
  { component: 'salary_gross', gross: 'floor', from: null, to: civil('2027-06-04') },
  { component: 'director_basis', basis: 'board-only', from: civil('2027-06-05'), to: null },
  { component: 'rent_monthly', amount: euros(300), from: null, to: null },
])
const RAISED = scenario('raised', 2027, [{ component: 'salary_gross', gross: euros(2500), from: null, to: null }])

describe('switchedScenario', () => {
  it('cuts each scenario to its part of the year and leaves the dividend out', () => {
    const switched = switchedScenario(FLOOR, BOARD, civil('2027-06-05'))

    expect(switched.slug).toBe('floor+board')
    expect(switched.components.map((component) => [component.component, component.from, component.to])).toEqual([
      // The floor scenario until 4 June. Its December gift falls after the switch, so it is gone.
      ['salary_gross', null, '2027-06-04'],
      // The board scenario from 5 June: its own salary ended on 4 June, the basis and the rent go on.
      ['director_basis', '2027-06-05', null],
      ['rent_monthly', '2027-06-05', null],
    ])
  })

  it('moves a tax-free item of the second scenario to the switch day at the earliest', () => {
    const switched = switchedScenario(BOARD, FLOOR, civil('2027-03-01'))
    expect(switched.components.find((component) => component.component === 'nontaxable')?.from).toBe('2027-12-01')
    const early = switchedScenario(
      BOARD,
      scenario('gift', 2027, [
        { component: 'salary_gross', gross: 'floor', from: null, to: null },
        { component: 'nontaxable', item: 'occasional-gift', amount: euros(133), from: null, to: null },
      ]),
      civil('2027-03-01'),
    )
    expect(early.components.find((component) => component.component === 'nontaxable')?.from).toBe('2027-03-01')
  })
})

describe('ownerPayPlan', () => {
  const scenarios = [FLOOR, BOARD, RAISED, scenario('old', 2026, [{ component: 'salary_gross', gross: 'floor', from: null, to: null }])]

  it('takes one scenario for the year without its dividend', () => {
    const plan = ownerPayPlan([planOwnerPay(2027, 'floor')], scenarios)
    expect(plan.kind).toBe('planned')
    expect(plan.kind === 'planned' ? plan.pay.scenario.components.map((component) => component.component) : []).toEqual(['salary_gross', 'nontaxable'])
    expect(plan.kind === 'planned' ? plan.pay.switchOn : 'none').toBeNull()
  })

  it('switches on the dated row', () => {
    const plan = ownerPayPlan([planOwnerPay(2027, 'floor', null, 2), planOwnerPay(2027, 'board', '2027-06-05', 3)], scenarios)
    expect(plan.kind === 'planned' ? [plan.pay.first.slug, plan.pay.second?.slug, plan.pay.switchOn] : plan.kind).toEqual(['floor', 'board', '2027-06-05'])
  })

  it('has nothing to plan without an owner pay row', () => {
    expect(ownerPayPlan([planLine(null, 'ai-services', 10, '', 2027)], scenarios)).toEqual({ kind: 'none' })
  })

  it.each([
    [
      'two switches',
      [planOwnerPay(2027, 'floor', null, 2), planOwnerPay(2027, 'board', '2027-06-05', 3), planOwnerPay(2027, 'raised', '2027-09-01', 4)],
      "The owner pay of 2027 switches on 2027-06-05 and 2027-09-01. A year's plan switches once, from one scenario to another.",
    ],
    [
      'a switch with nothing before it',
      [planOwnerPay(2027, 'board', '2027-06-05', 3)],
      'The owner pay switches to board on 2027-06-05, but no row without a date sets it before then. Add the scenario 2027 starts with.',
    ],
    [
      'a switch on 1 January',
      [planOwnerPay(2027, 'floor', null, 2), planOwnerPay(2027, 'board', '2027-01-01', 3)],
      'The switch to board is dated 1 January 2027, which leaves the first scenario no day. Leave its date blank instead.',
    ],
    ['a scenario of another year', [planOwnerPay(2027, 'old', null, 2)], 'The owner pay of 2027 names old, a scenario for 2026.'],
    [
      'two salaries in the switch month',
      [planOwnerPay(2027, 'floor', null, 2), planOwnerPay(2027, 'raised', '2027-06-15', 3)],
      'The owner pay of 2027: The floor salary to 2027-06-14 and the salary of 2500.00 from 2027-06-15 both pay a salary in 2027-06. A salary can change only from the first of a month.',
    ],
  ])('refuses %s', (_case, lines, reason) => {
    const plan = ownerPayPlan(lines, scenarios)
    expect(plan.kind === 'refused' ? plan.guards.map((guard) => guard.reason) : plan.kind).toEqual([reason])
  })
})

describe('planGuards', () => {
  it('allows one dividend a year and refuses a second', () => {
    expect(planGuards([planLine(6, 'dividend', 5000, '', 2027)], [])).toEqual([])
    const one = planLine(6, 'dividend', 5000, '', 2027)
    const two = { ...planLine(9, 'dividend', 1000, '', 2027), id: recordIdOf(PLAN_RECORDS, 'row-5') }
    expect(planGuards([one, two], [])).toEqual([{ ids: [one.id, two.id], reason: 'The plan for 2027 pays a dividend in month 6 and month 9. Plan one payout a year.' }])
    expect(planGuards([planLine(6, 'dividend', 5000, '', 2026), planLine(6, 'dividend', 5000, '', 2027)], [])).toEqual([])
  })
})
