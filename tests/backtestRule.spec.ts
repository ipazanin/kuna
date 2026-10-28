import { describe, expect, it } from 'vitest'

import { backtestRuleChange } from '../src/apps/company/rules/domain/backtestRule'
import { categorise } from '../src/apps/company/rules/domain/categorise'
import { proposeRule } from '../src/apps/company/rules/domain/proposeRule'
import type { Rule, RuleCondition } from '../src/apps/company/rules/domain/rule'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { Category } from '../src/apps/company/workbook/domain/workbook'
import { isHumanConfirmed } from '../src/apps/company/workbook/domain/needsReview'
import { ledger } from './fixtures/ledger'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'

const SHOP_IBAN = 'XX00FAKE0000000011'
const CLIENT_IBAN = 'XX00FAKE0000000012'

const context = categorisationContextOf({ accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }], clients: [], settings: DEFAULT_SETTINGS })

function rule(id: string, order: number, conditions: RuleCondition[], category: string, confidence: Rule['confidence'] = 'rule'): Rule {
  return { id, order, enabled: true, conditions, category, confidence, note: '' }
}

const RULES: readonly Rule[] = [
  rule('travel-by-name', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel'),
  rule('equipment-shop', 200, [{ column: 'counterparty_iban', iban: SHOP_IBAN }], 'equipment'),
  rule('card-review', 300, [{ column: 'is_card' }], 'card-purchase-unknown', 'review'),
]

const CATEGORIES: readonly Category[] = [
  { slug: 'travel', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
  { slug: 'equipment', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
  { slug: 'ai-services', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
  { slug: 'revenue', family: 'income', bucket: 'income', colour: BUCKET_COLOUR, roles: ['revenue'], vat: 'none', ownerShare: null },
]

describe('backtestRuleChange', () => {
  const rows = ledger([
    { date: '2026-09-01', amount: -20, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'card-purchase-unknown', flaggedBy: 'ai' },
    { date: '2026-09-02', amount: -30, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'ai-services', flaggedBy: 'ivan' },
    { date: '2026-09-03', amount: -40, counterparty: 'MODEL API INC', description: 'Transfer', iban: SHOP_IBAN, category: 'equipment', flaggedBy: 'rule' },
    { date: '2026-09-04', amount: -50, counterparty: 'MODEL API INC', description: '411111XXXXXX1111, MODEL API', category: 'travel', flaggedBy: 'ivan' },
    { date: '2026-09-05', amount: -60, counterparty: 'AIRLINE MODEL API', category: 'travel', flaggedBy: 'rule' },
  ])

  it('sorts every changed verdict into settled, broken agreements and human conflicts', () => {
    const candidate = rule('merchant-model-api', 150, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], 'ai-services')

    const result = backtestRuleChange(RULES, [...RULES, candidate], rows, context)

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

    const changed = Object.values(backtestRuleChange(RULES, [...RULES, candidate], rows, context)).flat()

    expect(changed.map((change) => change.transaction.amount)).not.toContain(-6000)
  })

  it('settles nothing with a review rule', () => {
    const candidate = rule('model-review', 50, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], '', 'review')

    expect(backtestRuleChange(RULES, [...RULES, candidate], rows, context).settled).toEqual([])
  })

  it('sets each list against its own side: the stored category of a waiting or confirmed row, the current verdict of a broken agreement', () => {
    const candidate = rule('merchant-model-api', 150, [{ column: 'counterparty_contains', fragment: 'MODEL API' }], 'ai-services')

    const result = backtestRuleChange(RULES, [...RULES, candidate], rows, context)

    expect(result.settled.map((change) => [change.from, change.after.category])).toEqual([['card-purchase-unknown', 'ai-services']])
    expect(result.brokenAgreements.map((change) => [change.from, change.before.category, change.after.category])).toEqual([['equipment', 'equipment', 'ai-services']])
    expect(result.humanConflicts.map((change) => [change.from, change.transaction.category, change.after.category])).toEqual([['travel', 'travel', 'ai-services']])
  })

  it('shows a broken agreement as what the rules decide now, not the stored category, when the two differ', () => {
    const accountant = 'XX00FAKE0000000014'
    const [filedEarlier] = ledger([{ date: '2026-09-20', amount: -150, counterparty: 'Ledger & Co', iban: accountant, category: 'accounting', flaggedBy: 'rule' }])
    const current = [rule('advice', 100, [{ column: 'counterparty_iban', iban: accountant }], 'consulting')]
    const proposed = [...current, rule('accountant', 50, [{ column: 'counterparty_iban', iban: accountant }], 'accounting')]

    const [broken, ...others] = backtestRuleChange(current, proposed, [filedEarlier!], context).brokenAgreements

    expect(others).toEqual([])
    expect([broken!.from, broken!.after.category, broken!.transaction.category]).toEqual(['consulting', 'accounting', 'accounting'])
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

  it('names a card purchase by its merchant, not by the bank account it settles against', () => {
    const settlement = 'XX00FAKE0000000003'
    const cardContext = categorisationContextOf({
      accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }],
      clients: [],
      settings: { ...DEFAULT_SETTINGS, cardSettlementIbans: [settlement] },
    })
    const [row] = ledger([{ date: '2026-09-01', amount: -19, counterparty: 'Example Bank d.d. · VISA OFFICE,EXAMPLE.GOV', iban: settlement, category: 'travel', flaggedBy: 'ivan' }])

    expect(proposeRule(row!, workbook, cardContext)).toMatchObject({
      id: 'merchant-visa-office-example-gov',
      conditions: [{ column: 'counterparty_contains', fragment: 'VISA OFFICE,EXAMPLE.GOV' }],
    })
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
