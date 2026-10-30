import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { ScenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome'
import { compareScenarios, letterOf, refusalText } from '../src/apps/loans/scenarios/presentation/scenarioComparison'
import type { ComparedScenario, ScenarioComparison } from '../src/apps/loans/scenarios/presentation/scenarioComparison'
import { slotsOf, slotsText, toggledSlots, useScenarioCompare } from '../src/apps/loans/scenarios/presentation/useScenarioCompare'
import { civil, euros } from './fixtures/ledger'

/** A loan as it stands from today: 240 instalments of 600.00 to March 2048. */
function outcome(overrides: Partial<ScenarioOutcome> = {}): ScenarioOutcome {
  return {
    nextInstalment: euros(600),
    highestInstalment: { amount: euros(600), estimate: false },
    afterMove: null,
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

function scenario(key: string, slot: number, overrides: Partial<ScenarioOutcome> = {}): ComparedScenario {
  return { key, name: key, slot, outcome: outcome(overrides) }
}

function line(comparison: ScenarioComparison, key: string) {
  return comparison.lines.find((entry) => entry.key === key)!
}

describe('scenarios side by side', () => {
  const stands = scenario('as-it-stands', 1)
  // B pays 5,000.00 extra and ends 2 years and 7 months sooner, C moves to another bank with 1,500.00 of costs.
  const extra = scenario('extra', 2, { instalments: 209, payoff: civil('2045-08-20'), interest: euros(34_500), extra: euros(5000), total: euros(138_500) })
  const move = scenario('move', 3, { afterMove: euros(570), highestInstalment: { amount: euros(612), estimate: true }, interest: euros(32_000), costs: euros(1500), total: euros(137_500) })

  it('keeps the columns in their slots and marks the base, wherever the base is', () => {
    const comparison = compareScenarios([move, stands, extra], 'extra', 'loan', '')

    expect(comparison.columns.map((column) => [column.letter, column.key, column.colour, column.isBase])).toEqual([
      ['A', 'as-it-stands', '--scenario-1', false],
      ['B', 'extra', '--scenario-2', true],
      ['C', 'move', '--scenario-3', false],
    ])
    expect(letterOf(4)).toBe('D')
  })

  it('ticks the one best figure of a line, lower, fewer or earlier, and none a line has no better way for', () => {
    const comparison = compareScenarios([stands, extra, move], 'as-it-stands', 'loan', 'APN')
    const ticks = (key: string) => line(comparison, key).cells.map((cell) => cell.best)

    expect(ticks('interest')).toEqual([false, false, true])
    expect(ticks('instalments')).toEqual([false, true, false])
    expect(ticks('payoff')).toEqual([false, true, false])
    expect(ticks('total')).toEqual([false, false, true])
    expect(ticks('extra')).toEqual([false, false, false])
    // A and B share the lowest next instalment, so nobody's is ticked.
    expect(ticks('next-instalment')).toEqual([false, false, false])
  })

  it('gives every other column its difference to the base, and leaves the base and an equal figure without one', () => {
    const comparison = compareScenarios([stands, extra, move], 'as-it-stands', 'loan', '')
    const differences = (key: string) => line(comparison, key).cells.map((cell) => cell.difference)

    expect(differences('interest')).toEqual([null, '−€5,500.00', '−€8,000.00'])
    expect(differences('payoff')).toEqual([null, '2 y 7 m sooner', null])
    expect(differences('instalments')).toEqual([null, '−31', null])
    expect(differences('next-instalment')).toEqual([null, null, null])
    expect(line(comparison, 'payoff').cells[1]!.text).toBe('Aug 2045')
  })

  it('drops a money line every scenario holds at nothing, and shows the instalment after a move only beside one', () => {
    const withMove = compareScenarios([stands, extra, move], 'as-it-stands', 'loan', '')
    const withoutMove = compareScenarios([stands, extra], 'as-it-stands', 'loan', '')

    expect(withMove.lines.map((entry) => entry.key)).toEqual(['next-instalment', 'highest-instalment', 'after-move', 'instalments', 'payoff', 'interest', 'extra', 'costs', 'total'])
    expect(withoutMove.lines.map((entry) => entry.key)).toEqual(['next-instalment', 'highest-instalment', 'instalments', 'payoff', 'interest', 'extra', 'total'])
    expect(line(withMove, 'after-move').cells.map((cell) => cell.text)).toEqual(['–', '–', '€570.00'])
    expect(line(withMove, 'highest-instalment').cells.map((cell) => cell.estimate)).toEqual([false, false, true])
    expect(line(withMove, 'total').total).toBe(true)
  })

  it('ticks no line only one scenario holds a figure on', () => {
    const comparison = compareScenarios([stands, move], 'as-it-stands', 'loan', '')

    expect(line(comparison, 'after-move').cells.map((cell) => cell.best)).toEqual([false, false])
  })

  it('names the subsidy line after who pays it', () => {
    const subsidised = compareScenarios([scenario('as-it-stands', 1, { subsidy: euros(1050) })], 'as-it-stands', 'loan', 'APN')

    expect(line(subsidised, 'subsidy').label).toBe('APN pays')
    expect(compareScenarios([scenario('as-it-stands', 1, { subsidy: euros(1050) })], 'as-it-stands', 'loan', '').lines.at(-2)!.label).toBe('Subsidy pays')
  })

  it('ticks no interest or total across offers of different terms, since a shorter loan always pays less interest', () => {
    const twenty = scenario('twenty', 1, { instalments: 240, interest: euros(58_785.57), total: euros(208_785.57), nextInstalment: euros(869.94) })
    const thirty = scenario('thirty', 2, { instalments: 360, interest: euros(92_483.3), total: euros(242_483.3), nextInstalment: euros(673.57) })
    const offers = compareScenarios([twenty, thirty], 'twenty', 'offers', '')
    const sameTerm = compareScenarios([twenty, { ...thirty, outcome: { ...thirty.outcome, instalments: 240 } }], 'twenty', 'offers', '')

    expect(line(offers, 'interest').cells.map((cell) => cell.best)).toEqual([false, false])
    expect(line(offers, 'total').cells.map((cell) => cell.best)).toEqual([false, false])
    expect(line(offers, 'next-instalment').cells.map((cell) => cell.best)).toEqual([false, true])
    expect(line(sameTerm, 'interest').cells.map((cell) => cell.best)).toEqual([true, false])
    expect([line(offers, 'instalments').label, line(offers, 'interest').label]).toEqual(['Instalments in all', 'Interest'])
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
    const compare = app.runWithContext(() =>
      useScenarioCompare(
        () => ['offers'],
        () => [],
      ),
    )

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

  it('reads the address, freeing a key the tab does not have or holds twice and dropping free slots at the end', () => {
    expect(slotsOf('b,,d', available, 3)).toEqual(['b', null, 'd'])
    expect(slotsOf('b,gone,b,d', available, 4)).toEqual(['b', null, null, 'd'])
    expect(slotsOf('b,d,', available, 3)).toEqual(['b', 'd'])
    expect(slotsOf('b,c,d,e', available, 3)).toEqual(['b', 'c', 'd'])
    expect(slotsOf('', available, 3)).toEqual([])
  })
})
