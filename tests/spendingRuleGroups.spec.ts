import { describe, expect, it } from 'vitest'

import { ruleGroups, ruleOverlaps } from '../src/apps/spending/statements/domain/ruleGroups'
import { typedCondition, typedConditions } from '../src/apps/spending/statements/domain/typedConditions'
import type { Category } from '../src/apps/spending/workbook/domain/category'
import { CATEGORY_RECORDS, RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { SpendingRule, SpendingRuleCondition } from '../src/apps/spending/workbook/domain/spendingRule'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

function category(key: string, name: string, kind: Category['kind'] = 'spending', parent: Category | null = null): Category {
  return { id: recordIdOf(CATEGORY_RECORDS, key), name, kind, parent: parent?.id ?? null, order: 1, colour: '', hidden: false }
}

const TRANSPORT = category('transport', 'Transport')
const FUEL = category('fuel', 'Fuel', 'spending', TRANSPORT)
const FOOD = category('food', 'Food')
const GROCERIES = category('groceries', 'Groceries', 'spending', FOOD)
const OTHER_FOOD = category('other-food', 'Other', 'spending', FOOD)
const OTHER_TRANSPORT = category('other-transport', 'Other', 'spending', TRANSPORT)
const SALARY = category('salary', 'Salary', 'income')
const CATEGORIES = [TRANSPORT, FUEL, FOOD, GROCERIES, OTHER_FOOD, OTHER_TRANSPORT, SALARY]

const IBAN = 'HR2923400091110000001'

function words(fragment: string): SpendingRuleCondition {
  return { column: 'counterparty_contains', fragment }
}

function rule(key: string, order: number, condition: SpendingRuleCondition, into: Category): SpendingRule {
  return { id: recordIdOf(RULE_RECORDS, key), order, condition, category: into.id, withdrawal: null }
}

describe('rules that can both hold for one payee', () => {
  it('finds words where one holds the other, folded as categorising folds them, and names the rule tried first', () => {
    const ina = rule('ina', 2, words('ina'), GROCERIES)
    const split = rule('split', 1, words('INA  Split'), FUEL)
    const corner = rule('corner', 3, words('Corner market'), GROCERIES)

    expect(ruleOverlaps([ina, split, corner], CATEGORIES)).toEqual([{ first: split, then: ina, firstOnlyMoneyIn: false }])
  })

  it('folds accents away, so Čakovec and Cakovec overlap', () => {
    const accented = rule('accented', 1, words('Ina Čakovec'), FUEL)
    const plain = rule('plain', 2, words('cakovec'), GROCERIES)

    expect(ruleOverlaps([accented, plain], CATEGORIES)).toHaveLength(1)
  })

  it('leaves out rules of one category, which file the same row the same way', () => {
    expect(ruleOverlaps([rule('one', 1, words('Ina'), FUEL), rule('two', 2, words('Ina Split'), FUEL)], CATEGORIES)).toEqual([])
  })

  it('finds the same IBAN on two categories, however it is grouped, and never pairs an IBAN with words', () => {
    const fuel = rule('fuel', 1, { column: 'counterparty_iban', iban: IBAN }, FUEL)
    const groceries = rule('groceries', 2, { column: 'counterparty_iban', iban: 'hr29 2340 0091 1100 0000 1' }, GROCERIES)
    const text = rule('text', 3, words('HR29'), OTHER_FOOD)

    expect(ruleOverlaps([fuel, groceries, text], CATEGORIES)).toEqual([{ first: fuel, then: groceries, firstOnlyMoneyIn: false }])
  })

  it('says when the first rule files only money in, since a rule on an income category does', () => {
    const salary = rule('salary', 1, words('Ina'), SALARY)
    const fuel = rule('fuel', 2, words('Ina Split'), FUEL)

    expect(ruleOverlaps([salary, fuel], CATEGORIES)).toEqual([{ first: salary, then: fuel, firstOnlyMoneyIn: true }])
    expect(ruleOverlaps([{ ...salary, order: 3 }, fuel], CATEGORIES)[0]?.firstOnlyMoneyIn).toBe(false)
  })

  it('takes the trying order from the order, then the id', () => {
    const later = rule('b', 1, words('Ina'), GROCERIES)
    const earlier = rule('a', 1, words('Ina Split'), FUEL)

    expect(ruleOverlaps([later, earlier], CATEGORIES)[0]?.first).toBe(earlier)
  })
})

describe('rules grouped by category', () => {
  it('sorts the groups by category name, then by the group they sit under, with each group’s rules in trying order', () => {
    const rules = [
      rule('kozjak', 4, words('Ina Kozjak Sjever'), FUEL),
      rule('split', 2, words('Ina Split'), FUEL),
      rule('market', 3, words('Corner market'), GROCERIES),
      rule('kiosk', 1, words('Kiosk'), OTHER_TRANSPORT),
      rule('bakery', 5, words('Bakery'), OTHER_FOOD),
    ]
    const groups = ruleGroups({ rules, categories: CATEGORIES })

    expect(groups.map((group) => [group.category.name, group.parent?.name ?? null])).toEqual([
      ['Fuel', 'Transport'],
      ['Groceries', 'Food'],
      ['Other', 'Food'],
      ['Other', 'Transport'],
    ])
    expect(groups[0]?.rules.map((held) => held.id)).toEqual([rules[1]!.id, rules[0]!.id])
  })

  it('gives each overlap to both groups it touches', () => {
    const split = rule('split', 1, words('Ina Split'), FUEL)
    const ina = rule('ina', 2, words('Ina'), GROCERIES)
    const groups = ruleGroups({ rules: [split, ina], categories: CATEGORIES })

    expect(groups.map((group) => group.overlaps.length)).toEqual([1, 1])
  })
})

describe('payees and IBANs typed one to a line', () => {
  it('reads a line that is an IBAN as the other side’s IBAN, without its spaces', () => {
    expect(typedCondition(' hr29 2340 0091 1100 0000 1 ')).toEqual({ column: 'counterparty_iban', iban: IBAN })
  })

  it('reads any other line as words in the payee’s name, spaces tidied', () => {
    expect(typedCondition('  Ina   Split ')).toEqual(words('Ina Split'))
    expect(typedCondition('HR2923400091110000002')).toEqual(words('HR2923400091110000002'))
    expect(typedCondition('   ')).toBeNull()
  })

  it('leaves out blank lines and lines typed twice', () => {
    expect(typedConditions('Ina Split\n\nIna Pleternica\r\nIna Split\nIna Kozjak Sjever')).toEqual([words('Ina Split'), words('Ina Pleternica'), words('Ina Kozjak Sjever')])
  })
})
