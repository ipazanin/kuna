import { describe, expect, it } from 'vitest'

import { STARTING_CATEGORIES } from '../src/apps/company/packs/hr-doo/preset/domain/startingCategories'
import { startingRules } from '../src/apps/company/packs/hr-doo/preset/domain/startingRules'
import { CATEGORY_CLASSES } from '../src/apps/company/packs/hr-doo/preset/domain/taxClassOf'
import { categoriesToSort } from '../src/apps/company/packs/hr-doo/preset/presentation/categoriesToSort'
import { categoryClassRefusals } from '../src/apps/company/settings/domain/categoryGuards'
import { categoryColourOf } from '../src/apps/company/workbook/domain/categoryColour'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { civil } from './fixtures/ledger'

describe('startingRules', () => {
  it('files the payments of 2026 to the state, each waiting on review and citing the Naputak', () => {
    const rules = startingRules(civil('2026-03-01'))

    expect(rules.map((rule) => [rule.id, rule.conditions, rule.category, rule.confidence])).toEqual([
      [
        'state-vat',
        [
          { column: 'direction', direction: 'debit' },
          { column: 'revenue_code', code: '1201' },
        ],
        'vat',
        'review',
      ],
      [
        'state-profit-tax',
        [
          { column: 'direction', direction: 'debit' },
          { column: 'revenue_code', code: '1651' },
        ],
        'corporate-income-tax',
        'review',
      ],
      [
        'state-pension-pillar-one',
        [
          { column: 'direction', direction: 'debit' },
          { column: 'revenue_code', code: '8168' },
        ],
        'payroll-contributions',
        'review',
      ],
      [
        'state-pension-pillar-two',
        [
          { column: 'direction', direction: 'debit' },
          { column: 'counterparty_iban', iban: 'HR7610010051700036001' },
        ],
        'payroll-contributions',
        'review',
      ],
      [
        'state-health-insurance',
        [
          { column: 'direction', direction: 'debit' },
          { column: 'counterparty_iban', iban: 'HR6510010051550100001' },
        ],
        'payroll-contributions',
        'review',
      ],
    ])
    expect(rules[0]?.note).toBe('Naputak 2026 (NN 18/26): VAT, revenue code 1201, model HR68')
    expect(rules.every((rule) => rule.enabled)).toBe(true)
    expect(new Set(rules.map((rule) => rule.order)).size).toBe(rules.length)
  })

  it('gives a day of 2027 the rules of 2026 until a later Naputak is in the ruleset, and a day before 2026 none', () => {
    expect(startingRules(civil('2027-06-01'))).toEqual(startingRules(civil('2026-03-01')))
    expect(startingRules(civil('2025-12-31'))).toEqual([])
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
