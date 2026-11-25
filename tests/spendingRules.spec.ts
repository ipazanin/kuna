import { describe, expect, it } from 'vitest'

import { unsplitItem } from '../src/apps/spending/entries/application/entryWrites'
import { rowsRulesWouldChange, writeRules } from '../src/apps/spending/statements/application/statementWrites'
import type { RuleEdits } from '../src/apps/spending/statements/application/statementWrites'
import { ruleOverlaps } from '../src/apps/spending/statements/domain/ruleOverlaps'
import { rulesOutcome, rulesRerun } from '../src/apps/spending/statements/domain/spendingCategorisation'
import { RULE_CODEC } from '../src/apps/spending/workbook/domain/ruleReading'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import { ITEM_CODEC } from '../src/apps/spending/workbook/domain/transactionItemReading'
import { ITEM_RECORDS, LABEL_RECORDS, RULE_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { ruleProblem } from '../src/apps/spending/workbook/domain/spendingRule'
import type { SpendingRule, SpendingRuleCondition } from '../src/apps/spending/workbook/domain/spendingRule'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { accountMoneyFromAmount, accountMoneyFromCents } from '../src/shared/money/accountMoney'
import { currencyCodeOf } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { OTP, REVOLUT_EUR, REVOLUT_USD, category, payeeContains, row, spendingBook } from './fixtures/spending'

const GROCERIES = category('Food/Groceries').id
const EATING_OUT = category('Food/Eating out').id
const COFFEE = recordIdOf(LABEL_RECORDS, 'label-coffee')
const TRIP = recordIdOf(LABEL_RECORDS, 'label-trip')
const GARDEN = recordIdOf(LABEL_RECORDS, 'label-garden')

let place = 0
function ruleOf(conditions: readonly SpendingRuleCondition[], fields: Partial<SpendingRule> = {}): SpendingRule {
  place += 1
  return { id: recordIdOf(RULE_RECORDS, `rule-${place}`), order: place, conditions, category: GROCERIES, labels: [], stop: false, withdrawal: null, link: null, ...fields }
}

const bankRow = (fields: Partial<Omit<StoredRow, 'amount' | 'date'>> & { readonly euros?: number; readonly on?: typeof OTP; readonly date?: string } = {}): StoredRow => {
  const { euros = -12.5, on = OTP, date = '2026-10-20', ...rest } = fields
  return row(on, date, euros, null, { source: 'statement', payee: 'Caffe Bar Đir', description: 'Card payment', ...rest })
}

function holds(condition: SpendingRuleCondition, held: StoredRow = bankRow()): boolean {
  return rulesOutcome([ruleOf([condition])], spendingBook([]))(held).filing !== null
}

describe('a condition of a Spending rule', () => {
  it.each<[string, SpendingRuleCondition, boolean]>([
    ['payee is, folded', { test: 'payee_is', values: ['caffe bar đir'], not: false }, true],
    ['payee is, not a part of it', { test: 'payee_is', values: ['Caffe'], not: false }, false],
    ['payee contains any of its values', { test: 'payee_contains', values: ['coffee', 'bar'], not: false }, true],
    ['payee contains, accents dropped', { test: 'payee_contains', values: ['CAFFÉ'], not: false }, true],
    ['payee starts with', { test: 'payee_starts_with', values: ['caffe'], not: false }, true],
    ['payee starts with, not in the middle', { test: 'payee_starts_with', values: ['bar'], not: false }, false],
    ['payee matches a regular expression in any case', { test: 'payee_matches', values: ['^caf+e\\b'], not: false }, true],
    ['payee does not contain', { test: 'payee_contains', values: ['airport'], not: true }, true],
    ['payee does not contain what it holds', { test: 'payee_contains', values: ['bar'], not: true }, false],
    ['description contains', { test: 'description_contains', values: ['card'], not: false }, true],
    ['description starts with', { test: 'description_starts_with', values: ['payment'], not: false }, false],
    ['description matches', { test: 'description_matches', values: ['pay(ment)?$'], not: false }, true],
    ['IBAN is, on a row without one', { test: 'iban_is', values: ['HR1210010051863000160'], not: false }, false],
    ['has no IBAN', { test: 'iban_none', not: false }, true],
    ['money out', { test: 'money_out', not: false }, true],
    ['money in', { test: 'money_in', not: false }, false],
    ['amount at least, without its sign', { test: 'amount_at_least', amount: accountMoneyFromAmount(12.5), not: false }, true],
    ['amount at most', { test: 'amount_at_most', amount: accountMoneyFromAmount(10), not: false }, false],
    ['account one of', { test: 'accounts', accounts: [REVOLUT_EUR.id, OTP.id], not: false }, true],
    ['account not one of', { test: 'accounts', accounts: [OTP.id], not: true }, false],
    ['day of the month in the span, both ends counted', { test: 'days', days: { from: 15, to: 20 }, not: false }, true],
    ['day of the month outside the span', { test: 'days', days: { from: 1, to: 19 }, not: false }, false],
    ['currency of the account', { test: 'currencies', currencies: [currencyCodeOf('EUR')!], not: false }, true],
  ])('%s', (_name, condition, expected) => {
    expect(holds(condition)).toBe(expected)
  })

  it('tests the IBAN with its spaces gone, and a currency by the row account', () => {
    expect(holds({ test: 'iban_is', values: ['HR12 1001 0051 8630 0016 0'], not: false }, bankRow({ counterpartyIban: 'HR1210010051863000160' }))).toBe(true)
    expect(holds({ test: 'currencies', currencies: [currencyCodeOf('USD')!], not: false }, bankRow({ on: REVOLUT_USD }))).toBe(true)
  })

  it('needs every condition to hold', () => {
    const cafe = ruleOf([payeeContains('caffe', 'coffee'), { test: 'money_out', not: false }, { test: 'payee_contains', values: ['airport'], not: true }])
    const outcome = rulesOutcome([cafe], spendingBook([]))
    expect(outcome(bankRow()).filing).toBe(cafe)
    expect(outcome(bankRow({ euros: 12.5 })).filing).toBeNull()
    expect(outcome(bankRow({ payee: 'Airport Coffee' })).filing).toBeNull()
  })
})

describe('the order of Spending rules', () => {
  it('takes the category from the first rule that files and the labels from the first that labels', () => {
    const labelsOnly = ruleOf([payeeContains('caffe')], { category: null, labels: [COFFEE] })
    const files = ruleOf([payeeContains('bar')], { category: EATING_OUT, labels: [TRIP] })
    const later = ruleOf([payeeContains('đir')], { category: GROCERIES })
    expect(rulesOutcome([later, files, labelsOnly], spendingBook([]))(bankRow())).toEqual({ filing: files, labelling: labelsOnly })
  })

  it('tries no rule after one with Stop here that holds', () => {
    const stops = ruleOf([payeeContains('caffe')], { category: null, labels: [COFFEE], stop: true })
    const files = ruleOf([payeeContains('bar')], { category: EATING_OUT })
    expect(rulesOutcome([stops, files], spendingBook([]))(bankRow())).toEqual({ filing: null, labelling: stops })
    expect(rulesOutcome([{ ...stops, stop: false }, files], spendingBook([]))(bankRow()).filing).toBe(files)
  })

  it('holds a rule on an income category for money in only', () => {
    const income = ruleOf([payeeContains('caffe')], { category: category('Income/Other income').id })
    expect(rulesOutcome([income], spendingBook([]))(bankRow()).filing).toBeNull()
    expect(rulesOutcome([income], spendingBook([]))(bankRow({ euros: 5 })).filing).toBe(income)
  })
})

describe('a stored Spending rule', () => {
  const id = recordIdOf(RULE_RECORDS, 'a0000000-0000-4000-8000-000000000001')
  const make = (fields: Readonly<Record<string, string | boolean>>) => RULE_CODEC.make(storedFieldsOfValues({ order: '1', ...fields }), id)

  it('writes every kind of condition and reads it back', () => {
    const rule = ruleOf(
      [
        payeeContains('Caffe, bar', 'Coffee | shop'),
        { test: 'payee_matches', values: ['^ina\\b'], not: true },
        { test: 'iban_is', values: ['HR1210010051863000160'], not: false },
        { test: 'iban_none', not: true },
        { test: 'money_out', not: false },
        { test: 'amount_at_least', amount: accountMoneyFromAmount(25), not: false },
        { test: 'accounts', accounts: [OTP.id], not: false },
        { test: 'days', days: { from: 1, to: 15 }, not: false },
        { test: 'currencies', currencies: [currencyCodeOf('EUR')!], not: false },
      ],
      { category: null, labels: [COFFEE], stop: true },
    )
    const fields = RULE_CODEC.fieldsOf(rule)
    expect(fields).toMatchObject({ payee_contains: 'Caffe, bar\nCoffee | shop', not_payee_matches: '^ina\\b', amount_at_least: '25.00', days: '1-15', stop: true })
    expect(RULE_CODEC.make(storedFieldsOfValues(fields), rule.id)).toEqual(rule)
  })

  it('reads a rule of a file from before conditions as the condition it meant', () => {
    expect(make({ counterparty_contains: 'Corner market', category: 'x' }).conditions).toEqual([payeeContains('Corner market')])
  })

  it.each(['direction', 'has_counterparty_iban', 'counterparty_is_own', 'counterparty_is_client', 'tx_domain', 'tx_family', 'tx_sub_family', 'purpose', 'revenue_code', 'is_card', 'foreign_currency'])(
    'refuses a rule holding %s, a condition only Company reads',
    (column) => {
      expect(() => make({ payee_contains: 'a', category: 'x', [column]: 'credit' })).toThrow(`Spending's rules read no ${column}`)
    },
  )

  it.each([
    [{ category: 'x' }, 'tests at least one thing'],
    [{ payee_contains: 'a', category: 'x', money_out: true }, ''],
    [{ payee_matches: '(', category: 'x' }, 'is not one'],
    [{ payee_contains: 'a' }, 'files a category, adds labels, or both'],
    [{ days: '20-5', payee_contains: 'a', category: 'x' }, 'two days of a month'],
    [{ amount_at_least: 'many', category: 'x' }, 'is not a number'],
    [{ currencies: 'EUR | XYZ', category: 'x' }, 'XYZ'],
  ])('refuses what cannot be kept: %o', (fields, reason) => {
    if (reason === '') expect(() => make(fields)).not.toThrow()
    else expect(() => make(fields)).toThrow(reason)
  })

  it('refuses a test made twice the same way, and takes it once more turned around', () => {
    expect(ruleProblem(ruleOf([payeeContains('a'), payeeContains('b')]))).toBe('repeated-test')
    expect(ruleProblem(ruleOf([payeeContains('a'), { ...payeeContains('b'), not: true }]))).toBeNull()
  })
})

describe('rules over the rows already in the book', () => {
  it('adds the labels of the rule that labels, keeps the labels a row has, and leaves a row a labels-only rule fits waiting', () => {
    const waiting = bankRow()
    const labelled = rulesRerun(spendingBook([waiting]), [ruleOf([payeeContains('caffe')], { category: null, labels: [COFFEE] })]).changes
    expect(labelled).toHaveLength(1)
    expect(labelled[0]!.after.categorisedBy).toBeNull()
    expect(labelled[0]!.items![0]).toMatchObject({ category: null, labels: [COFFEE] })
  })

  it('writes only the rule when the person picks Only new rows, and the rule and its rows on Apply', () => {
    const waiting = bankRow()
    const book = spendingBook([waiting])
    const edits = { adding: [{ conditions: [payeeContains('caffe')], category: GROCERIES, labels: [], stop: false, withdrawal: null, link: null }] }
    const only = recording()
    writeRules(only.unit, book, edits, null, false)
    expect(only.written).toEqual(['add'])
    const applied = recording()
    writeRules(applied.unit, book, edits, null, true)
    expect(applied.written.length).toBeGreaterThan(1)
  })

  it('leaves the rows a rule kept for new rows skipped when another rule is applied, moved or deleted, and counts only what that rule changes', () => {
    const kept = ruleOf([payeeContains('caffe')], { order: 1 })
    const skipped = bankRow()
    const fuel = bankRow({ payee: 'Ina Split' })
    const book = spendingBook([skipped, fuel], { rules: [kept] })
    const edits = { adding: [{ conditions: [payeeContains('ina')], category: category('Transport/Fuel').id, labels: [], stop: false, withdrawal: null, link: null }] }

    expect(rowsRulesWouldChange(book, edits, null)).toBe(1)
    const applied = recording()
    writeRules(applied.unit, book, edits, null, true)
    expect(applied.changed.map(([before]) => before)).toEqual([fuel])

    const other = ruleOf([payeeContains('ina')], { order: 2 })
    const both = spendingBook([skipped], { rules: [kept, other] })
    const moved = recording()
    writeRules(moved.unit, both, { moving: { rule: other.id, direction: 'up' } }, null)
    expect(moved.changed.map(([before]) => before)).not.toContain(skipped)
    const deleted = recording()
    writeRules(deleted.unit, both, { deleting: [other] }, null)
    expect(deleted.written).toEqual(['remove'])
  })

  it('applies only the labels of a second rule to a row a filing rule kept for new rows skipped, and keeps the row waiting', () => {
    const files = ruleOf([payeeContains('caffe')], { order: 1 })
    const waiting = bankRow()
    const book = spendingBook([waiting], { rules: [files] })
    const edits: RuleEdits = { adding: [{ conditions: [payeeContains('bar')], category: null, labels: [TRIP], stop: false, withdrawal: null, link: null }] }

    const { changes } = rulesRerun(book, [files, ruleOf([payeeContains('bar')], { order: 2, category: null, labels: [TRIP] })])
    expect(changes).toHaveLength(1)
    expect(changes[0]!.after.categorisedBy).toBeNull()
    expect(changes[0]!.items![0]).toMatchObject({ category: null, labels: [TRIP], ruleLabels: [TRIP] })
    expect(rowsRulesWouldChange(book, edits, null)).toBe(1)
  })

  it('files a row by a second rule without the labels of a labels-only rule kept for new rows', () => {
    const labels = ruleOf([payeeContains('caffe')], { order: 1, category: null, labels: [TRIP] })
    const book = spendingBook([bankRow()], { rules: [labels] })
    const { changes } = rulesRerun(book, [labels, ruleOf([payeeContains('bar')], { order: 2, category: EATING_OUT })])
    expect(changes[0]!.after.categorisedBy).toBe('rule')
    expect(changes[0]!.items![0]).toMatchObject({ category: EATING_OUT, labels: [] })
  })

  it('applies a rule saved again with Apply to the rows it skipped when it was kept for new rows', () => {
    const files = ruleOf([payeeContains('caffe')], { order: 1 })
    const waiting = bankRow()
    const book = spendingBook([waiting], { rules: [files] })
    const edits: RuleEdits = { changing: [{ rule: files, draft: files }] }
    expect(rowsRulesWouldChange(book, edits, null)).toBe(1)
    const { unit, changed } = recording()
    writeRules(unit, book, edits, null)
    expect(changed.map(([before]) => before)).toContainEqual(waiting)
  })

  it('counts and moves the rows a move changes, and nothing when the order decides none', () => {
    const fuel = ruleOf([payeeContains('ina')], { order: 1, category: category('Transport/Fuel').id })
    const market = ruleOf([payeeContains('ina market')], { order: 2, category: GROCERIES })
    const filed = bankRow({ payee: 'Ina market Pula', category: category('Transport/Fuel').id, categorisedBy: 'rule' })
    const book = spendingBook([filed, bankRow({ payee: 'Ina Split', category: category('Transport/Fuel').id, categorisedBy: 'rule' })], { rules: [fuel, market] })
    const moving: RuleEdits = { moving: { rule: market.id, direction: 'up' } }
    expect(rowsRulesWouldChange(book, moving, null)).toBe(1)
    const { unit, changed } = recording()
    writeRules(unit, book, moving, null)
    expect(changed.map(([before]) => before)).toContainEqual(filed)
    const only = recording()
    writeRules(only.unit, book, moving, null, false)
    expect(only.changed.map(([before]) => before)).toEqual([market, fuel])
    expect(rowsRulesWouldChange(spendingBook([], { rules: [fuel, market] }), moving, null)).toBe(0)
  })

  it('moves a rule one place up and numbers the rules in their new order', () => {
    const first = ruleOf([payeeContains('a')], { order: 1 })
    const second = ruleOf([payeeContains('b')], { order: 2 })
    const { unit, changed } = recording()
    writeRules(unit, spendingBook([], { rules: [first, second] }), { moving: { rule: second.id, direction: 'up' } }, null)
    expect(changed).toEqual([
      [second, { ...second, order: 1 }],
      [first, { ...first, order: 2 }],
    ])
  })

  it('takes back the labels a changed rule no longer gives, and never a label put on by hand', () => {
    const garden = ruleOf([payeeContains('caffe')], { order: 1, category: null, labels: [GARDEN] })
    const byRule = bankRow()
    const byHand = bankRow({ payee: 'Caffe Bar Most' })
    const items = [
      { ...wholeItemOf(byRule, { category: null, note: '', link: null, labels: [GARDEN], ruleLabels: [GARDEN] }) },
      { ...wholeItemOf(byHand, { category: null, note: '', link: null, labels: [GARDEN] }) },
    ]
    const book = spendingBook([byRule, byHand], { rules: [garden], items })
    const { changes } = rulesRerun(book, [{ ...garden, labels: [TRIP] }])
    expect(changes.map(({ before, items: after }) => [before, after![0]!.labels, after![0]!.ruleLabels])).toEqual([
      [byRule, [TRIP], [TRIP]],
      [byHand, [GARDEN, TRIP], [TRIP]],
    ])
    expect(rulesRerun(book, []).changes.map(({ before, items: after }) => [before, after![0]!.labels])).toEqual([[byRule, []]])
  })

  it('adds the labels of a rule to a row you filed and keeps its category', () => {
    const filed = bankRow({ category: EATING_OUT, categorisedBy: 'person' })
    const { changes } = rulesRerun(spendingBook([filed]), [ruleOf([payeeContains('caffe')], { category: GROCERIES, labels: [COFFEE] })])
    expect(changes).toHaveLength(1)
    expect(changes[0]!.after).toBe(filed)
    expect(changes[0]!.items![0]).toMatchObject({ category: EATING_OUT, labels: [COFFEE], ruleLabels: [COFFEE] })
  })

  it("gives each part of a split row the labels of a rule, takes back only those a rule put on, and keeps each part's category", () => {
    const split = bankRow({ euros: -30, categorisedBy: 'person' })
    const whole = wholeItemOf(split, { category: GROCERIES, note: '', link: null, labels: [GARDEN], ruleLabels: [GARDEN] })
    const parts = [
      { ...whole, amount: accountMoneyFromCents(-1000) },
      { ...whole, id: recordIdOf(ITEM_RECORDS, 'part-2'), amount: accountMoneyFromCents(-2000), category: EATING_OUT, labels: [GARDEN, COFFEE], ruleLabels: [] },
    ]
    const garden = ruleOf([payeeContains('caffe')], { category: null, labels: [GARDEN] })
    const book = spendingBook([split], { rules: [garden], items: parts })

    const { changes } = rulesRerun(book, [{ ...garden, labels: [TRIP] }])
    expect(changes).toHaveLength(1)
    expect(changes[0]!.after).toBe(split)
    expect(changes[0]!.items!.map((part) => [part.category, part.labels, part.ruleLabels])).toEqual([
      [GROCERIES, [TRIP], [TRIP]],
      [EATING_OUT, [GARDEN, COFFEE, TRIP], [TRIP]],
    ])
    expect(rowsRulesWouldChange(book, { changing: [{ rule: garden, draft: { ...garden, labels: [TRIP] } }] }, null)).toBe(1)
  })

  it("keeps the labels a rule put on as a rule's when a split row is joined back into one, and one any part has by hand as yours", () => {
    const split = bankRow({ euros: -30, categorisedBy: 'person' })
    const whole = wholeItemOf(split, { category: GROCERIES, note: '', link: null, labels: [GARDEN, TRIP], ruleLabels: [GARDEN, TRIP] })
    const parts = [
      { ...whole, amount: accountMoneyFromCents(-1000) },
      { ...whole, id: recordIdOf(ITEM_RECORDS, 'part-2'), amount: accountMoneyFromCents(-2000), labels: [GARDEN, TRIP], ruleLabels: [GARDEN] },
    ]
    expect(unsplitItem(split, parts)).toMatchObject({ labels: [GARDEN, TRIP], ruleLabels: [GARDEN] })
  })

  it('stores the labels a rule put on, and reads a file from before them as having none from a rule', () => {
    const entry = bankRow()
    const item = wholeItemOf(entry, { category: null, note: '', link: null, labels: [COFFEE, TRIP], ruleLabels: [TRIP] })
    const fields = ITEM_CODEC.fieldsOf(item)
    expect(fields['rule_labels']).toBe('label-trip')
    expect(ITEM_CODEC.make(storedFieldsOfValues(fields), item.id)).toEqual(item)
    const { rule_labels: _left, ...older } = fields
    expect(ITEM_CODEC.make(storedFieldsOfValues(older), item.id).ruleLabels).toEqual([])
  })

  it('counts the rows two rules of different categories both fit, the first deciding', () => {
    const fuel = ruleOf([payeeContains('ina')], { category: category('Transport/Fuel').id })
    const groceries = ruleOf([payeeContains('ina market')], { category: GROCERIES })
    const rows = [bankRow({ payee: 'INA market Split' }), bankRow({ payee: 'Ina market Pula' }), bankRow({ payee: 'Ina Split' })]
    expect(ruleOverlaps(spendingBook(rows, { rules: [fuel, groceries] }))).toEqual([{ first: fuel, then: groceries, rows: 2 }])
    expect(ruleOverlaps(spendingBook(rows, { rules: [{ ...fuel, stop: true }, groceries] }))).toEqual([])
  })
})

describe('a rule added with the conditions of one already there', () => {
  const conditions = [payeeContains('caffe')]

  it('keeps the category of the rule there when it only brings labels, and counts the rows its labels reach', () => {
    const filing = ruleOf(conditions, { category: EATING_OUT })
    const filed = bankRow({ category: EATING_OUT, categorisedBy: 'rule' })
    const book = spendingBook([filed], { rules: [filing] })
    const edits: RuleEdits = { adding: [{ conditions, category: null, labels: [COFFEE], stop: false, withdrawal: null, link: null }] }

    expect(rowsRulesWouldChange(book, edits, null)).toBe(1)
    const { unit, written, changed } = recording()
    writeRules(unit, book, edits, null)
    expect(written.filter((verb) => verb === 'add')).toEqual([])
    expect(changed[0]).toEqual([filing, { ...filing, labels: [COFFEE] }])
    expect(changed[1]![1]).toEqual(filed)
  })

  it('keeps the labels and Stop here of the rule there when it only brings a category', () => {
    const held = ruleOf(conditions, { category: EATING_OUT, labels: [COFFEE], stop: true })
    const { unit, changed } = recording()
    writeRules(unit, spendingBook([], { rules: [held] }), { adding: [{ conditions, category: GROCERIES, labels: [], stop: false, withdrawal: null, link: null }] }, null)
    expect(changed).toEqual([[held, { ...held, category: GROCERIES }]])
  })

  it('takes the labels and Stop here it brings', () => {
    const held = ruleOf(conditions, { category: EATING_OUT, labels: [COFFEE] })
    const { unit, changed } = recording()
    writeRules(unit, spendingBook([], { rules: [held] }), { adding: [{ conditions, category: null, labels: [TRIP], stop: true, withdrawal: null, link: null }] }, null)
    expect(changed).toEqual([[held, { ...held, labels: [TRIP], stop: true }]])
  })
})

/** A unit of work that notes what each write does. */
function recording() {
  const written: string[] = []
  const changed: [unknown, unknown][] = []
  const unit = {
    of: () => ({
      add: () => written.push('add'),
      change: (before: unknown, after: unknown) => {
        written.push('change')
        changed.push([before, after])
      },
      remove: () => written.push('remove'),
    }),
  } as unknown as UnitOfWork
  return { unit, written, changed }
}
