import { describe, expect, it } from 'vitest'

import { backtestRule, isHumanConfirmed } from '../src/features/rules/domain/backtestRule'
import { categorise } from '../src/features/rules/domain/categorise'
import { proposeRule } from '../src/features/rules/domain/proposeRule'
import type { Rule, RuleCondition } from '../src/features/rules/domain/rule'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { Category } from '../src/features/workbook/domain/workbook'
import { ledger } from './fixtures/ledger'

const SHOP_IBAN = 'XX00FAKE0000000011'
const CLIENT_IBAN = 'XX00FAKE0000000012'

const context = categorisationContextOf({ accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }], settings: DEFAULT_SETTINGS })

function rule(id: string, order: number, conditions: RuleCondition[], category: string, confidence: Rule['confidence'] = 'rule'): Rule {
  return { id, order, enabled: true, conditions, category, confidence, note: '', sheetRow: order / 100 + 1 }
}

const RULES: readonly Rule[] = [
  rule('travel-by-name', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel'),
  rule('equipment-shop', 200, [{ column: 'counterparty_iban', iban: SHOP_IBAN }], 'equipment'),
  rule('card-review', 300, [{ column: 'is_card' }], 'card-purchase-unknown', 'review'),
]

const CATEGORIES: readonly Category[] = [
  { slug: 'travel', family: 'operating', bucket: 'operating', colour: '', roles: [] },
  { slug: 'equipment', family: 'operating', bucket: 'operating', colour: '', roles: [] },
  { slug: 'ai-services', family: 'operating', bucket: 'operating', colour: '', roles: [] },
  { slug: 'revenue', family: 'income', bucket: 'income', colour: '', roles: ['revenue'] },
]

describe('backtestRule', () => {
  const rows = ledger([
    { date: '2026-09-01', amount: -20, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'card-purchase-unknown', flaggedBy: 'ai' },
    { date: '2026-09-02', amount: -30, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'ai-services', flaggedBy: 'ivan' },
    { date: '2026-09-03', amount: -40, counterparty: 'MODEL API INC', description: 'Transfer', iban: SHOP_IBAN, category: 'equipment', flaggedBy: 'rule' },
    { date: '2026-09-04', amount: -50, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'travel', flaggedBy: 'ivan' },
    { date: '2026-09-05', amount: -60, counterparty: 'AIRLINE MODEL API', category: 'travel', flaggedBy: 'rule' },
  ])

  it('sorts every changed verdict into settled, broken agreements and human conflicts', () => {
    const candidate = rule('merchant-model-api', 150, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], 'ai-services')

    const result = backtestRule(candidate, RULES, rows, context)

    expect(result.settled.map((change) => [change.transaction.amount, change.before.category, change.after.category])).toEqual([
      [-2000, 'card-purchase-unknown', 'ai-services'],
    ])
    expect(result.brokenAgreements.map((change) => [change.transaction.amount, change.before.ruleId, change.after.ruleId])).toEqual([
      [-4000, 'equipment-shop', 'merchant-model-api'],
    ])
    expect(result.humanConflicts.map((change) => [change.transaction.amount, change.transaction.category, change.after.category])).toEqual([
      [-5000, 'travel', 'ai-services'],
    ])
  })

  it('leaves a row out when a rule above the candidate still decides it', () => {
    const candidate = rule('merchant-model-api', 150, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], 'ai-services')

    const changed = Object.values(backtestRule(candidate, RULES, rows, context)).flat()

    expect(changed.map((change) => change.transaction.amount)).not.toContain(-6000)
  })

  it('places a candidate after an existing rule of the same order, as an appended row lands', () => {
    const sameOrder = { ...rule('also-travel', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'equipment'), sheetRow: null }

    expect(Object.values(backtestRule(sameOrder, RULES, rows, context)).flat()).toEqual([])
  })

  it('settles nothing with a review rule', () => {
    const candidate = rule('model-review', 50, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], '', 'review')

    expect(backtestRule(candidate, RULES, rows, context).settled).toEqual([])
  })

  it('counts any flagged_by but rule, ai and blank as a person', () => {
    expect(['ivan', 'human', 'rule', 'ai', ''].map((flaggedBy) => isHumanConfirmed({ flaggedBy }))).toEqual([true, true, false, false, false])
  })
})

describe('proposeRule', () => {
  const workbook = { rules: RULES, categories: CATEGORIES }

  it('names the counterparty by IBAN when the row has one, and goes after the rules when none decides the row', () => {
    const [row] = ledger([{ date: '2026-09-01', amount: -10, counterparty: 'Desk Co', iban: 'XX00FAKE0000000013', category: 'equipment', flaggedBy: 'ivan' }])

    expect(proposeRule(row!, workbook, context)).toEqual({
      id: 'iban-equipment',
      order: 400,
      enabled: true,
      conditions: [{ column: 'counterparty_iban', iban: 'XX00FAKE0000000013' }],
      category: 'equipment',
      confidence: 'rule',
      note: 'A counterparty whose account settles the category on its own.',
      sheetRow: null,
    })
  })

  it('takes a merchant fragment from the name, and goes just before the rule that decides the row today', () => {
    const [row] = ledger([{ date: '2026-09-01', amount: -20, counterparty: 'Model Api Inc · monthly', description: '411111XXXXXX1111, X', category: 'ai-services', flaggedBy: 'ivan' }])

    const proposed = proposeRule(row!, workbook, context)

    expect(proposed).toMatchObject({ id: 'merchant-model-api-inc', order: 250, conditions: [{ column: 'counterparty_contains', fragment: 'MODEL API INC' }] })
    expect(categorise(row!, [...RULES, proposed!], context)).toMatchObject({ category: 'ai-services', flaggedBy: 'rule' })
  })

  it('adds the direction when the category is one side of a pair, and keeps the id unused', () => {
    const [row] = ledger([{ date: '2026-09-01', amount: 900, counterparty: 'Client Ltd', iban: CLIENT_IBAN, category: 'revenue', flaggedBy: 'ivan' }])
    const taken = { rules: [...RULES, rule('iban-revenue-credit', 900, [{ column: 'purpose', code: 'X' }], 'revenue')], categories: CATEGORIES }

    expect(proposeRule(row!, taken, context)).toMatchObject({
      id: 'iban-revenue-credit-2',
      conditions: [
        { column: 'counterparty_iban', iban: CLIENT_IBAN },
        { column: 'direction', direction: 'credit' },
      ],
    })
  })

  it('goes ahead of the first rule when that rule decides the row', () => {
    const [row] = ledger([{ date: '2026-09-01', amount: -20, counterparty: 'AIRLINE CO', category: 'equipment', flaggedBy: 'ivan' }])

    expect(proposeRule(row!, workbook, context)?.order).toBe(0)
  })

  it('proposes nothing for an undefined category or a row that names no counterparty', () => {
    const [unknownCategory, nameless] = ledger([
      { date: '2026-09-01', amount: -20, counterparty: 'Desk Co', category: 'nope', flaggedBy: 'ivan' },
      { date: '2026-09-02', amount: -20, counterparty: '', category: 'equipment', flaggedBy: 'ivan' },
    ])

    expect(proposeRule(unknownCategory!, workbook, context)).toBeNull()
    expect(proposeRule(nameless!, workbook, context)).toBeNull()
  })
})
