import { describe, expect, it } from 'vitest'

import { STARTING_CATEGORIES } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import { startingRules } from '../src/apps/company/packs/hr-doo/preset/domain/startingRules'
import { CATEGORY_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClassOf'
import { categoriesToSort } from '../src/apps/company/packs/hr-doo/preset/presentation/categoriesToSort'
import { categoryClassRefusals } from '../src/apps/company/categories/domain/categoryGuards'
import { categoryColourOf } from '../src/apps/company/workbook/domain/categoryColour'
import { categorisationContextOf } from '../src/apps/company/rules/domain/categorisationContext'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { BY_HAND_SOURCES, NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { categorise } from '../src/apps/company/rules/domain/categorise'
import { moneyFromAmount } from '../src/shared/money/money'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { NO_SIGNALS, civil } from './fixtures/ledger'

describe('startingRules', () => {
  it('files the payments of 2026 to the state, each waiting on review and citing the Naputak', () => {
    const rules = startingRules(civil('2026-03-01'))

    const interest = { column: 'description_contains', fragment: 'KAMAT' }
    const states: readonly [id: string, condition: object, category: string][] = [
      ['state-vat', { column: 'revenue_code', code: '1201' }, 'vat'],
      ['state-profit-tax', { column: 'revenue_code', code: '1651' }, 'corporate-income-tax'],
      ['state-pension-pillar-one', { column: 'revenue_code', code: '8168' }, 'payroll-contributions'],
      ['state-pension-pillar-two', { column: 'counterparty_iban', iban: 'HR7610010051700036001' }, 'payroll-contributions'],
      ['state-health-insurance', { column: 'counterparty_iban', iban: 'HR6510010051550100001' }, 'payroll-contributions'],
    ]
    const debit = { column: 'direction', direction: 'debit' }
    expect(rules.map((rule) => [rule.id, rule.conditions, rule.category, rule.confidence])).toEqual(
      states.flatMap(([id, condition, category]) => [
        [`${id}-interest`, [debit, condition, interest], 'late-payment-interest', 'review'],
        [id, [debit, condition], category, 'review'],
      ]),
    )
    expect(rules[1]?.note).toBe('Naputak 2026 (NN 18/26): VAT, revenue code 1201, model HR68')
    expect(rules[0]?.note).toBe('Naputak 2026 (NN 18/26): VAT, revenue code 1201, model HR68, interest on a late payment')
    expect(rules.every((rule) => rule.enabled)).toBe(true)
    expect(new Set(rules.map((rule) => rule.order)).size).toBe(rules.length)
  })

  it('gives a day of 2027 the rules of 2026 until a later Naputak is in the ruleset, and a day before 2026 none', () => {
    expect(startingRules(civil('2027-06-01'))).toEqual(startingRules(civil('2026-03-01')))
    expect(startingRules(civil('2025-12-31'))).toEqual([])
  })

  it('files interest on a late contribution or tax apart from the payment itself, though both go to the same account under the same code', () => {
    const rules = startingRules(civil('2026-03-01'))
    const context = categorisationContextOf({
      accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '', bank: '', sources: BY_HAND_SOURCES }],
      clients: [{ slug: 'acme', name: 'Acme', ibans: [], invoicing: NO_CLIENT_INVOICING }],
      settings: DEFAULT_SETTINGS,
    })
    const paid = (counterpartyIban: string, description: string, creditorReference = ''): string =>
      categorise({ account: 'main', amount: moneyFromAmount(-12.4), counterparty: '', counterpartyIban, description, signals: { ...NO_SIGNALS, creditorReference } }, rules, context).category

    expect(paid('HR6510010051550100001', 'Doprinos za zdravstveno osiguranje 03/2026')).toBe('payroll-contributions')
    expect(paid('HR6510010051550100001', 'Zatezne kamate na doprinos 03/2026')).toBe('late-payment-interest')
    expect(paid('', 'KAMATA PDV', 'HR68 1201-00000000000-26')).toBe('late-payment-interest')
    expect(paid('', 'PDV 02/2026', 'HR68 1201-00000000000-26')).toBe('vat')
  })

  it('files only to categories the starting set holds', () => {
    const slugs = STARTING_CATEGORIES.map((category) => category.slug)
    expect(startingRules(civil('2026-03-01')).filter((rule) => !slugs.includes(rule.category))).toEqual([])
  })
})

describe('the starting categories', () => {
  const asCategories: Category[] = STARTING_CATEGORIES.map((category) => ({ ...category, colour: categoryColourOf(category.colour), ownerShare: null }))

  it('give every category one class it keeps to, so new books read and save with no class problem', () => {
    expect(categoriesToSort(asCategories, civil('2026-10-30'), [])).toEqual([])
    expect(
      categoryClassRefusals(
        STARTING_CATEGORIES.map((category) => ({ before: null, after: category })),
        CATEGORY_CLASSES,
      ),
    ).toEqual([])
  })

  it('name each category once', () => {
    expect(new Set(STARTING_CATEGORIES.map((category) => category.slug)).size).toBe(STARTING_CATEGORIES.length)
  })
})
