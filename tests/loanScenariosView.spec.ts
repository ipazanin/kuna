import { describe, expect, it } from 'vitest'

import { rateOfText } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { blankChange, typedChange, typedCosts } from '../src/apps/loans/scenarios/presentation/changeTexts'
import type { ChangeRules } from '../src/apps/loans/scenarios/presentation/changeTexts'
import { changeSummary, offersComparison, scenarioKey, scenarioRows, slotted, workedOffers } from '../src/apps/loans/scenarios/presentation/scenariosView'
import { words as bankWords } from '../src/apps/loans/bankLoans/presentation/words'
import { MOST_COMPARED } from '../src/apps/loans/scenarios/presentation/scenarioComparison'
import { askedSlots, pickedOf } from '../src/apps/loans/scenarios/presentation/useScenarioCompare'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import type { FakeLoansSet } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import type { ScenarioBook } from '../src/apps/loans/workbook/domain/readLoanBook'
import { civil, euros } from './fixtures/ledger'

function offersOf(set: FakeLoansSet): ScenarioBook[] {
  const { workbook } = LOANS_DOCUMENT.read({
    meta: { id: 'scenarios', source: 'browser', title: 'scenarios', syncedAt: '2026-10-28T00:00:00Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document: fakeLoansDocument('2026-10-28T00:00:00Z', set),
  })
  return workbook.scenarios.filter(({ scenario }) => scenario.start.kind === 'offer')
}

/** The offers compared as the screen opens: the first ones, against the first column. */
function opened(scenarios: readonly ScenarioBook[], savings: string | null = null) {
  const worked = workedOffers(scenarios)
  const picked = pickedOf(
    askedSlots(
      null,
      scenarios.map((book) => scenarioKey(book.scenario)),
      MOST_COMPARED,
    ),
  )
  const compared = slotted(worked, picked)
  const base = picked[0]!.key
  return { worked, compared, base, comparison: offersComparison(compared, base, savings === null ? null : rateOfText(savings)) }
}

const line = (comparison: ReturnType<typeof opened>['comparison'], key: string) => comparison.lines.find((entry) => entry.key === key)!

describe('the offers on Scenarios', () => {
  it('keeps to offers, leaving the scenarios of a loan you have to its own page', () => {
    expect(offersOf('sample').map(({ scenario }) => scenario.name)).toEqual(['Jadran Bank offer', 'Coastal Bank offer', 'Lighthouse Bank offer'])
  })

  it("compares offers over their whole loan, the instalment first, with Kuna's EKS beside the bank's", () => {
    const { comparison } = opened(offersOf('sample'))

    expect(comparison.lines[0]!.label).toBe('Monthly instalment')
    // Coastal Bank turns variable after five years and Lighthouse Bank repays equal principal, so each shows its last instalment under its first.
    expect(line(comparison, 'instalment').cells.map((cell) => [cell.text, cell.second])).toEqual([
      ['€660.26', null],
      ['€605.45', 'last €633.13'],
      ['€1,166.67', 'last €836.11'],
    ])
    expect(line(comparison, 'eks').cells.map((cell) => [cell.text, cell.best, cell.difference])).toEqual([
      ['3.09%', true, null],
      ['3.56%', false, '0.47 points higher'],
      ['4.07%', false, '0.98 points higher'],
    ])
    expect(line(comparison, 'bank-eks').cells.map((cell) => cell.text)).toEqual(['3.09%', '–', '–'])
    expect(line(comparison, 'interest').cells.map((cell) => cell.best)).toEqual([false, false, false])
  })

  it('adds what each offer leaves you ahead once the savings rate is typed in', () => {
    const scenarios = offersOf('sample')

    expect(line(opened(scenarios, '3').comparison, 'left-over').cells[0]!.text).toBe('€0.00')
    expect(opened(scenarios).comparison.lines.some((entry) => entry.key === 'left-over')).toBe(false)
  })

  it('lists every offer, the ones not compared said so', () => {
    const scenarios = offersOf('sample')
    const worked = workedOffers(scenarios)
    const compared = slotted(worked, pickedOf([scenarioKey(scenarios[1]!.scenario)]))

    expect(scenarioRows(worked, compared, scenarioKey(scenarios[1]!.scenario)).map((row) => [row.mark?.letter ?? null, row.detail.split(' · ')[0]])).toEqual([
      [null, 'Not compared'],
      ['A', '€140,000.00 over 360 instalments'],
      [null, 'Not compared'],
    ])
  })
})

describe('the slots the address asks for', () => {
  const available = ['b', 'c', 'd', 'e']

  it('fills the first scenarios when the address asks for none, or only for keys it does not have', () => {
    expect(askedSlots(null, available, 3)).toEqual(['b', 'c', 'd'])
    expect(askedSlots('x,y', available, 3)).toEqual(['b', 'c', 'd'])
  })

  it('keeps every slot free when the address asks for none of them, and a known key in its slot', () => {
    expect(askedSlots('', available, 3)).toEqual([])
    expect(askedSlots('x,c', available, 3)).toEqual([null, 'c'])
  })
})

describe('a change as the editor types it', () => {
  const rules: ChangeRules = { drawdown: civil('2023-03-10'), dues: new Set(['2027-01-20', '2027-02-20']) }

  it('reads a regular extra payment from its fields and says it in a sentence', () => {
    const texts = { ...blankChange(1, 'regular-extra-payment', civil('2027-01-20'), null), amount: '150' }
    const { change } = typedChange(texts, rules)

    expect(change).toEqual({ kind: 'regular-extra-payment', from: civil('2027-01-20'), every: 'month', until: null, amount: euros(150), effect: 'shorter-term' })
    expect(changeSummary(change!, bankWords.extraDialog.effects)).toBe('Extra €150.00 every month from 20 Jan 2027, shorter term.')
  })

  it('refuses a due date that is not one, an end before the first payment and a cost below zero', () => {
    const regular = { ...blankChange(1, 'regular-extra-payment', civil('2027-01-21'), null), amount: '150', until: '2026-12-01' }
    const move = { ...blankChange(2, 'move', civil('2027-02-20'), 240), rate: { rate: '2.9', rateType: 'fixed' as const }, costs: { upfront: '-5', monthly: '', yearly: '' } }

    expect(typedChange(regular, rules)).toMatchObject({ change: null, errors: { due: 'Choose a due date' } })
    expect(typedChange({ ...regular, due: '2027-01-20' }, rules).errors.until).toBe('On or after the first payment')
    expect(typedChange(move, rules)).toMatchObject({ change: null, errors: { upfront: 'An amount of zero or more with at most two decimals' } })
    expect(typedCosts({ upfront: '', monthly: '2', yearly: '' }).costs).toEqual({ upfront: euros(0), monthly: euros(2), yearly: euros(0) })
  })
})
