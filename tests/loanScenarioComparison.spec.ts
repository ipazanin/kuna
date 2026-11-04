import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ScenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome'
import { compareScenarios, letterOf, refusalText } from '../src/apps/loans/scenarios/presentation/scenarioComparison'
import type { ComparedScenario, ScenarioComparison } from '../src/apps/loans/scenarios/presentation/scenarioComparison'
import { slotsOf, slotsText, toggledSlots, useScenarioCompare } from '../src/apps/loans/scenarios/presentation/useScenarioCompare'
import { civil, euros } from './fixtures/ledger'
import { percent } from './fixtures/loans'

/** An offer of 240 instalments of 600.00 to March 2048. */
function outcome(overrides: Partial<ScenarioOutcome> = {}): ScenarioOutcome {
  return {
    nextInstalment: euros(600),
    lastInstalment: euros(600),
    instalmentChanges: false,
    instalments: 240,
    payoff: civil('2048-03-20'),
    interest: euros(40_000),
    extra: euros(0),
    costs: euros(0),
    subsidy: euros(0),
    total: euros(144_000),
    variableFrom: null,
    subsidyPayback: null,
    ...overrides,
  }
}

function scenario(key: string, slot: number, overrides: Partial<ScenarioOutcome> = {}, repayment: ComparedScenario['repayment'] = 'annuity'): ComparedScenario {
  return { key, name: key, slot, outcome: outcome(overrides), repayment }
}

function line(comparison: ScenarioComparison, key: string) {
  return comparison.lines.find((entry) => entry.key === key)!
}

describe('offers side by side', () => {
  const plain = scenario('plain', 1)
  // B pays 5,000.00 extra and ends 2 years and 7 months sooner, C is equal principal with 1,500.00 of costs.
  const extra = scenario('extra', 2, { instalments: 209, payoff: civil('2045-08-20'), interest: euros(34_500), extra: euros(5000), total: euros(138_500) })
  const falling = scenario(
    'falling',
    3,
    { nextInstalment: euros(766.67), lastInstalment: euros(417.36), instalmentChanges: true, interest: euros(32_000), costs: euros(1500), total: euros(137_500) },
    'equal-principal',
  )

  it('keeps the columns in their slots and marks the base, wherever the base is', () => {
    const comparison = compareScenarios([falling, plain, extra], 'extra')

    expect(comparison.columns.map((column) => [column.letter, column.key, column.colour, column.isBase])).toEqual([
      ['A', 'plain', '--scenario-1', false],
      ['B', 'extra', '--scenario-2', true],
      ['C', 'falling', '--scenario-3', false],
    ])
    expect(letterOf(4)).toBe('D')
  })

  it('leads with the monthly instalment, then interest, the total and the payoff, and the other lines only where a column has a figure', () => {
    const all = compareScenarios([plain, extra, falling], 'plain')
    const bare = compareScenarios([plain, { ...extra, outcome: { ...extra.outcome, extra: euros(0) } }], 'plain')

    expect(all.lines.map((entry) => entry.key)).toEqual(['instalment', 'interest', 'total', 'payoff', 'extra', 'costs'])
    expect(bare.lines.map((entry) => entry.key)).toEqual(['instalment', 'interest', 'total', 'payoff'])
    expect(line(all, 'total').total).toBe(true)
  })

  it('puts the last instalment under the first where the instalment changes, and none for an annuity at one rate', () => {
    const comparison = compareScenarios([plain, falling], 'plain')

    expect(line(comparison, 'instalment').cells.map((cell) => [cell.text, cell.second])).toEqual([
      ['€600.00', null],
      ['€766.67', 'last €417.36'],
    ])
  })

  it('ticks the one best figure of a line, lower or earlier, and none a line has no better way for', () => {
    const comparison = compareScenarios(
      [plain, { ...extra, outcome: { ...extra.outcome, instalments: 240 } }, { ...falling, repayment: 'annuity', outcome: { ...falling.outcome, nextInstalment: euros(590) } }],
      'plain',
    )
    const ticks = (key: string) => line(comparison, key).cells.map((cell) => cell.best)

    expect(ticks('interest')).toEqual([false, false, true])
    expect(ticks('payoff')).toEqual([false, true, false])
    expect(ticks('total')).toEqual([false, false, true])
    expect(ticks('extra')).toEqual([false, false, false])
    expect(ticks('instalment')).toEqual([false, false, true])
  })

  it('ticks no monthly instalment across annuity and equal principal offers, and keeps the ticks on interest and the total', () => {
    const sameTerm = { ...extra, outcome: { ...extra.outcome, instalments: 240 } }
    const fallingFromLess = { ...falling, outcome: { ...falling.outcome, nextInstalment: euros(590) } }
    const mixed = compareScenarios([plain, sameTerm, fallingFromLess], 'plain')
    const allAnnuity = compareScenarios([plain, sameTerm, { ...fallingFromLess, repayment: 'annuity' }], 'plain')
    const ticks = (comparison: ScenarioComparison, key: string) => line(comparison, key).cells.map((cell) => cell.best)

    expect(ticks(mixed, 'instalment')).toEqual([false, false, false])
    expect(ticks(mixed, 'interest')).toEqual([false, false, true])
    expect(ticks(mixed, 'total')).toEqual([false, false, true])
    expect(ticks(allAnnuity, 'instalment')).toEqual([false, false, true])
  })

  it('gives every other column its difference to the base, and leaves the base and an equal figure without one', () => {
    const comparison = compareScenarios([plain, extra, falling], 'plain')
    const differences = (key: string) => line(comparison, key).cells.map((cell) => cell.difference)

    expect(differences('interest')).toEqual([null, '−€5,500.00', '−€8,000.00'])
    expect(differences('payoff')).toEqual([null, '2 y 7 m sooner', null])
    expect(differences('instalment')).toEqual([null, null, '+€166.67'])
    expect(line(comparison, 'payoff').cells[1]!.text).toBe('Aug 2045')
  })

  it('marks an instalment worked out at a variable rate as an estimate', () => {
    const variable = scenario('variable', 2, { variableFrom: civil('2032-01-10'), instalmentChanges: true, lastInstalment: euros(640) })

    expect(line(compareScenarios([plain, variable], 'plain'), 'instalment').cells.map((cell) => cell.estimate)).toEqual([false, true])
  })

  it('ticks no interest or total across offers of different terms, since a shorter loan always pays less interest', () => {
    const twenty = scenario('twenty', 1, { instalments: 240, interest: euros(58_785.57), total: euros(208_785.57), nextInstalment: euros(869.94) })
    const thirty = scenario('thirty', 2, { instalments: 360, interest: euros(92_483.3), total: euros(242_483.3), nextInstalment: euros(673.57) })
    const offers = compareScenarios([twenty, thirty], 'twenty')
    const sameTerm = compareScenarios([twenty, { ...thirty, outcome: { ...thirty.outcome, instalments: 240 } }], 'twenty')

    expect(line(offers, 'interest').cells.map((cell) => cell.best)).toEqual([false, false])
    expect(line(offers, 'total').cells.map((cell) => cell.best)).toEqual([false, false])
    expect(line(offers, 'instalment').cells.map((cell) => cell.best)).toEqual([false, true])
    expect(line(sameTerm, 'interest').cells.map((cell) => cell.best)).toEqual([true, false])
  })

  it("adds Kuna's EKS, the bank's where one is typed, and what each leaves you ahead once a savings rate is", () => {
    const withRates = compareScenarios(
      [
        { ...plain, eks: percent('4.1'), bankEks: percent('4.12'), leftOver: euros(0) },
        { ...extra, eks: percent('4.05'), bankEks: null, leftOver: euros(120) },
      ],
      'plain',
    )

    expect(withRates.lines.map((entry) => entry.key).slice(-3)).toEqual(['eks', 'bank-eks', 'left-over'])
  })

  it('says why a scenario cannot be worked out', () => {
    expect(refusalText({ refused: 'not-a-due-date', date: civil('2028-03-03'), loan: 'Home loan' })).toBe('3 Mar 2028 is not a due date of Home loan.')
    expect(refusalText({ refused: 'two-moves' })).toBe('A scenario moves to another bank once at most.')
  })
})

describe('the savings rate in the address', () => {
  it('takes a rate typed with a decimal comma and keeps it with a dot', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/loans/scenarios', component: { render: () => null } }] })
    await router.push('/loans/scenarios')
    const app = createApp({}).use(router)
    const compare = app.runWithContext(() => useScenarioCompare(() => []))

    compare.setSavings('3,5')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(router.currentRoute.value.query).toEqual({ savings: '3.5' })
    expect(compare.savings.value).toBe(35_000)
  })
})

describe('the slots of the compared scenarios', () => {
  const available = ['b', 'c', 'd', 'e']

  it('keeps every other scenario in its slot through an unpick, and fills the freed slot first', () => {
    const picked = slotsOf('b,c,d', available, 3)
    const unpicked = toggledSlots(picked, 'c', 3)

    expect(unpicked).toEqual(['b', null, 'd'])
    expect(slotsText(unpicked)).toBe('b,,d')
    expect(toggledSlots(unpicked, 'e', 3)).toEqual(['b', 'e', 'd'])
    expect(toggledSlots(picked, 'e', 3)).toEqual(picked)
    expect(toggledSlots(['b'], 'b', 3)).toEqual([])
  })

  it('reads the address, freeing a key the screen does not have or holds twice and dropping free slots at the end', () => {
    expect(slotsOf('b,,d', available, 3)).toEqual(['b', null, 'd'])
    expect(slotsOf('b,gone,b,d', available, 4)).toEqual(['b', null, null, 'd'])
    expect(slotsOf('b,d,', available, 3)).toEqual(['b', 'd'])
    expect(slotsOf('b,c,d,e', available, 3)).toEqual(['b', 'c', 'd'])
    expect(slotsOf('', available, 3)).toEqual([])
  })
})
