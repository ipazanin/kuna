import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { addStartingCategory } from '../src/apps/company/categories/application/startingCategoryWrites'
import { missingStartingCategories, STARTING_CATEGORIES } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import { startingRules } from '../src/apps/company/packs/hr-doo/preset/domain/startingRules'
import { CONTRIBUTION_ACCOUNTS } from '../src/apps/company/packs/hr-doo/domain/salaries/contributionAccounts'
import { missingCategoriesToSort } from '../src/apps/company/packs/hr-doo/preset/presentation/categoriesToSort'
import { dismissalOfMissingCategory } from '../src/apps/company/rules/application/dismissalWrites'
import { placeRules } from '../src/apps/company/rules/domain/rulePlacement'
import { withoutDismissed } from '../src/apps/company/rules/domain/dismissedSuggestions'
import { categorisationContextOf } from '../src/apps/company/rules/domain/categorisationContext'
import { categoryColourOf } from '../src/apps/company/workbook/domain/categoryColour'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { categorise } from '../src/apps/company/rules/domain/categorise'
import type { Rule } from '../src/apps/company/rules/domain/rule'
import { moneyFromAmount } from '../src/shared/money/money'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { DISMISSAL_WRITES } from '../src/apps/company/rules/application/dismissalWrites'
import { NO_SIGNALS, civil } from './fixtures/ledger'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const ON = civil('2026-10-30')

describe('the starting categories older books lack', () => {
  it('offers only the starting categories a starting rule files into, with every starting rule, to books made without them', () => {
    const offers = missingStartingCategories([], [], [], ON)

    expect(offers.map((offer) => offer.category.slug)).toEqual(['vat', 'corporate-income-tax', 'payroll-contributions', 'late-payment-interest'])
    expect(offers.flatMap((offer) => offer.rules.map(({ rule }) => rule.id)).sort()).toEqual(
      startingRules(ON)
        .map((rule) => rule.id)
        .sort(),
    )
  })

  it('offers no starting category that no starting rule files into', () => {
    const filed = new Set(startingRules(ON).map((rule) => rule.category))

    expect(STARTING_CATEGORIES.some((category) => !filed.has(category.slug))).toBe(true)
    expect(missingStartingCategories([], [], [], ON).every((offer) => filed.has(offer.category.slug))).toBe(true)
  })

  it('offers none the books hold, a dismissed one, or a rule whose id the books hold', () => {
    const held = STARTING_CATEGORIES.filter((category) => category.slug !== 'late-payment-interest' && category.slug !== 'vat')
    const rules = startingRules(ON).filter((rule) => rule.category !== 'late-payment-interest')

    const offers = missingStartingCategories(held, rules, [dismissalOfMissingCategory('vat', ON)], ON)

    expect(offers.map((offer) => offer.category.slug)).toEqual(['late-payment-interest'])
    expect(offers[0]!.rules.map(({ rule, before }) => [rule.id, before])).toEqual([
      ['state-vat-interest', 'state-vat'],
      ['state-profit-tax-interest', 'state-profit-tax'],
      ['state-pension-pillar-one-interest', 'state-pension-pillar-one'],
      ['state-pension-pillar-two-interest', 'state-pension-pillar-two'],
      ['state-health-insurance-interest', 'state-health-insurance'],
    ])
    expect(missingStartingCategories(STARTING_CATEGORIES, startingRules(ON), [], ON)).toEqual([])
  })

  it('places each interest rule before the rule of its tax, so it files late interest though both share an order', () => {
    const older = startingRules(ON)
      .filter((rule) => rule.category !== 'late-payment-interest')
      .map((rule, index) => ({ ...rule, order: (index + 1) * 10 }))
    const [offer] = missingStartingCategories(
      STARTING_CATEGORIES.filter((category) => category.slug !== 'late-payment-interest'),
      older,
      [],
      ON,
    )
    const placed = placeRules(older, offer!.rules)
    const rules: Rule[] = [...older.map((rule) => ({ ...rule, order: placed.renumbered.get(rule.id) ?? rule.order })), ...placed.added]
    const context = categorisationContextOf({ accounts: [], clients: [], settings: DEFAULT_SETTINGS })
    const paid = (description: string) =>
      categorise({ account: 'main', amount: moneyFromAmount(-12.4), counterparty: '', counterpartyIban: 'HR6510010051550100001', description, signals: NO_SIGNALS }, rules, context).category

    expect(paid('Zatezne kamate na doprinos 03/2026')).toBe('late-payment-interest')
    expect(paid('Doprinos za zdravstveno osiguranje 03/2026')).toBe('payroll-contributions')
  })

  it('places a starting rule ahead of the books’ own rules when the books hold none of the starting rules around it', () => {
    const own: Rule = {
      id: 'health-insurance-payments',
      order: 10,
      enabled: true,
      conditions: [
        { column: 'direction', direction: 'debit' },
        { column: 'counterparty_iban', iban: CONTRIBUTION_ACCOUNTS.health },
      ],
      category: 'payroll-contributions',
      confidence: 'rule',
      note: '',
    }
    const [offer] = missingStartingCategories(
      STARTING_CATEGORIES.filter((category) => category.slug !== 'late-payment-interest'),
      [own],
      [],
      ON,
    )
    expect(offer!.rules.every(({ before }) => before === own.id)).toBe(true)
    const placed = placeRules([own], offer!.rules)
    const rules: Rule[] = [{ ...own, order: placed.renumbered.get(own.id) ?? own.order }, ...placed.added]
    const context = categorisationContextOf({ accounts: [], clients: [], settings: DEFAULT_SETTINGS })

    expect(
      categorise(
        {
          account: 'main',
          amount: moneyFromAmount(-12.4),
          counterparty: '',
          counterpartyIban: CONTRIBUTION_ACCOUNTS.health,
          description: 'Zatezne kamate na doprinos 03/2026',
          signals: NO_SIGNALS,
        },
        rules,
        context,
      ).category,
    ).toBe('late-payment-interest')
  })

  it('words a line for each offer with how many rules come with it', () => {
    const categories = STARTING_CATEGORIES.filter((category) => category.slug !== 'late-payment-interest').map((category) => ({
      ...category,
      colour: categoryColourOf(category.colour),
      ownerShare: null,
    }))
    const lines = missingCategoriesToSort({ categories, rules: [], dismissals: [] }, ON)

    expect(lines).toHaveLength(1)
    expect(lines[0]!.reason).toMatch(/and with 5 rules that file into it\. Add puts them all in\.$/)
  })

  it('leaves a missing-category dismissal out of the rule suggestions', () => {
    expect(withoutDismissed({ notCovered: [], exceptions: [] }, [dismissalOfMissingCategory('vat', ON)]).dismissed).toEqual([])
  })
})

describe('adding a starting category', () => {
  it('writes the category and its rules in one write that one Undo takes back, and a dismissal hides the offer', async () => {
    const { store } = await browserHarness(used, fakeWorkbookDocument('2026-10-16T09:00:00.000Z', 'browser'))
    const workbook = store.state.workbook!
    expect(missingStartingCategories(workbook.categories, workbook.rules, [], ON).map((offer) => offer.category.slug)).toContain('late-payment-interest')
    const [missing] = missingStartingCategories(
      workbook.categories.filter((category) => category.slug !== 'late-payment-interest'),
      workbook.rules.filter((rule) => !rule.id.endsWith('-interest')),
      [],
      ON,
    )
    const written = await store.write('Added', (unit) => addStartingCategory(unit, store.state.records!, workbook.rules, missing!))
    const after = store.state.workbook!
    expect(after.categories.find((category) => category.slug === missing!.category.slug)).toMatchObject({ family: missing!.category.family, roles: missing!.category.roles })
    expect(after.rules.filter((rule) => missing!.rules.some(({ rule: offered }) => offered.id === rule.id))).toHaveLength(missing!.rules.length)
    expect(after.problems.filter((problem) => problem.tab === 'rules' || problem.tab === 'categories')).toEqual(
      workbook.problems.filter((problem) => problem.tab === 'rules' || problem.tab === 'categories'),
    )

    await store.undo(store.state.writes.find((write) => write.receipt === written)!)
    expect(store.state.workbook!.categories).toEqual(workbook.categories)
    expect(store.state.workbook!.rules).toEqual(workbook.rules)

    await store.write('Dismissed', (unit) => unit.of(DISMISSAL_WRITES).add(dismissalOfMissingCategory('late-payment-interest', ON)))
    expect(missingStartingCategories(store.state.workbook!.categories, store.state.workbook!.rules, store.state.workbook!.dismissals, ON).map((offer) => offer.category.slug)).not.toContain(
      'late-payment-interest',
    )
  })
})
