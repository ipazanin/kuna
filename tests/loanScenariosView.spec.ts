import { describe, expect, it } from 'vitest'

import { rateOfText } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { blankChange, typedChange, typedCosts } from '../src/apps/loans/scenarios/presentation/changeTexts'
import type { ChangeRules } from '../src/apps/loans/scenarios/presentation/changeTexts'
import { againstBase, changeSummary, scenarioCards, scenarioKey, scenarioRows, scenarioTabs, slotted, tabComparison, workedScenarios } from '../src/apps/loans/scenarios/presentation/scenariosView'
import type { ScenariosTab } from '../src/apps/loans/scenarios/presentation/scenariosView'
import { askedSlots, pickedOf, slotCount } from '../src/apps/loans/scenarios/presentation/useScenarioCompare'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import type { FakeLoansSet } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-28')

function tabsOf(set: FakeLoansSet): ScenariosTab[] {
  const { workbook } = LOANS_DOCUMENT.read({
    meta: { id: 'scenarios', source: 'browser', title: 'scenarios', syncedAt: '2026-10-28T00:00:00Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document: fakeLoansDocument('2026-10-28T00:00:00Z', set),
  })
  return scenarioTabs(workbook, TODAY)
}

/** The tab compared as it opens: its first scenarios, against the first column. */
function opened(tab: ScenariosTab, savings: string | null = null) {
  const offers = tab.kind === 'offers'
  const worked = workedScenarios(tab, TODAY)
  const picked = pickedOf(
    askedSlots(
      null,
      tab.scenarios.map((book) => scenarioKey(book.scenario)),
      slotCount(offers),
    ),
    offers,
  )
  const compared = slotted(worked, picked)
  const base = picked[0]!.key
  return { worked, compared, base, comparison: tabComparison(tab, compared, base, savings === null ? null : rateOfText(savings)) }
}

const line = (comparison: ReturnType<typeof opened>['comparison'], key: string) => comparison.lines.find((entry) => entry.key === key)!

describe('the Scenarios tabs', () => {
  it('gives each bank loan a tab with its scenarios and counts the offers on their own tab', () => {
    expect(tabsOf('sample').map((tab) => [tab.kind, tab.label, tab.scenarios.length])).toEqual([
      ['loan', 'Home loan', 3],
      ['offers', 'Offers', 2],
    ])
    expect(tabsOf('house-and-car').map((tab) => [tab.label, tab.scenarios.length])).toEqual([
      ['Home loan', 3],
      ['Car loan', 0],
      ['Offers', 2],
    ])
  })

  it("compares a loan's scenarios from today against the loan as it stands, with every line's four figures", () => {
    const { comparison } = opened(tabsOf('sample')[0]!)

    expect(comparison.columns.map((column) => `${column.letter} ${column.name}`)).toEqual(['A As it stands', 'B €5,000 next spring', 'C €150 every month', 'D Move to Jadran Bank'])
    expect(line(comparison, 'payoff').cells.map((cell) => [cell.text, cell.difference])).toEqual([
      ['Mar 2048', null],
      ['Apr 2047', '11 m sooner'],
      ['Nov 2043', '4 y 4 m sooner'],
      ['Mar 2048', null],
    ])
    expect(line(comparison, 'total').cells.map((cell) => cell.text)).toEqual(['€223,826.53', '€218,325.43', '€207,899.16', '€208,223.94'])
    // B, C and D repay early by 20 Mar 2029, two years after the subsidy's last instalment, so the subsidy is paid back.
    expect(line(comparison, 'subsidy').cells.map((cell) => cell.warning)).toEqual([null, 'then paid back', 'then paid back', 'then paid back'])
  })

  it('adds what each scenario leaves you ahead once the savings rate is typed in, more being better', () => {
    const { comparison } = opened(tabsOf('sample')[0]!, '3')

    expect(line(comparison, 'left-over').cells.map((cell) => [cell.text, cell.best, cell.difference])).toEqual([
      ['€0.00', false, null],
      ['+€1,110.66', false, null],
      ['+€3,177.41', false, null],
      ['+€17,287.42', true, null],
    ])
    expect(opened(tabsOf('sample')[0]!).comparison.lines.some((entry) => entry.key === 'left-over')).toBe(false)
  })

  it("compares offers over their whole loan with Kuna's EKS beside the bank's", () => {
    const { comparison } = opened(tabsOf('sample')[1]!)

    expect(line(comparison, 'next-instalment').label).toBe('First instalment')
    expect(line(comparison, 'eks').cells.map((cell) => [cell.text, cell.best, cell.difference])).toEqual([
      ['3.09%', true, null],
      ['3.56%', false, '0.47 points higher'],
    ])
    expect(line(comparison, 'bank-eks').cells.map((cell) => cell.text)).toEqual(['3.09%', '–'])
    expect(line(comparison, 'interest').cells.map((cell) => cell.best)).toEqual([false, false])
  })

  it('cards each scenario with what it changes and its facts against the base', () => {
    const tab = tabsOf('sample')[0]!
    const { compared, base } = opened(tab)
    const cards = scenarioCards(tab, compared, base, TODAY)

    expect(cards.map((card) => [card.letter, card.isBase, card.subsidyBack])).toEqual([
      ['A', true, false],
      ['B', false, true],
      ['C', false, true],
      ['D', false, true],
    ])
    expect(cards[0]!.summary).toBe('The plan in the file: 3.1% fixed, then 3.85% variable from 20 Apr 2028, an estimate.')
    expect(cards[3]!.summary).toBe('A new loan from Jadran Bank pays this one off on 20 Mar 2028: 2.9% fixed over 240 instalments, costs €1,500.00 up front. Its costs are paid back by 31 Jan 2030.')
    expect(cards[1]!.facts.map((fact) => fact.caption)).toEqual(['11 m sooner', '€5,501.10 less', '€5,501.10 less'])
  })

  it('draws how much less each pays than the base and how much sooner, the longest bar the most', () => {
    const { compared, base } = opened(tabsOf('sample')[0]!)
    const { payLess, sooner } = againstBase(compared, base)

    expect(payLess.map((bar) => [bar.letter, bar.text, bar.share])).toEqual([
      ['B', '€5,501.10', 550_110 / 1_592_737],
      ['C', '€15,927.37', 1],
      ['D', '€15,602.59', 1_560_259 / 1_592_737],
    ])
    expect(sooner.map((bar) => [bar.letter, bar.text])).toEqual([
      ['B', '11 m'],
      ['C', '4 y 4 m'],
      ['D', 'the same, Mar 2048'],
    ])
  })

  it('lists every kept scenario, the ones not compared said so', () => {
    const tab = tabsOf('sample')[0]!
    const worked = workedScenarios(tab, TODAY)
    const compared = slotted(worked, pickedOf(['fa4e0000-0000-4000-8000-000000000020'], false))

    expect(scenarioRows(worked, compared, 'as-it-stands').map((row) => [row.mark?.letter ?? null, row.detail])).toEqual([
      ['A', 'The loan itself. Change it on its own page.'],
      ['B', '1 change · €5,501.10 less interest'],
      [null, 'Not compared · 1 change · €15,927.37 less interest'],
      [null, 'Not compared · 1 change · €17,102.59 less interest'],
    ])
  })
})

describe('the slots the address asks for', () => {
  const available = ['b', 'c', 'd', 'e']

  it('fills the first scenarios when the address asks for none, or only for keys of another tab', () => {
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
    expect(changeSummary(change!)).toBe('Extra €150.00 every month from 20 Jan 2027, shorter term.')
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
