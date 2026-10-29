import { describe, expect, it } from 'vitest'

import { confirmation } from '../src/apps/company/review/domain/verdictChanges'
import { RULE_CODEC, readRules } from '../src/apps/company/rules/domain/readRules'
import type { Rule, RuleCondition } from '../src/apps/company/rules/domain/rule'
import { ruleCoverage } from '../src/apps/company/rules/domain/ruleCoverage'
import { placeBefore, swapWithNeighbour } from '../src/apps/company/rules/domain/rulePlacement'
import { ruleFieldsOf, rulesTabAfter } from '../src/apps/company/rules/domain/rulesTabChange'
import { previewRulesChange } from '../src/apps/company/rules/domain/rulesChangePreview'
import { rulesChangeInWords } from '../src/apps/company/rules/domain/ruleSummary'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { ledgerKeyOf } from '../src/apps/company/workbook/domain/ledgerReading'
import { needsReview } from '../src/apps/company/workbook/domain/needsReview'
import { civil, ledger } from './fixtures/ledger'

const CATEGORIES = new Set(['equipment', 'travel', 'ai-services', 'revenue'])

function rule(id: string, order: number, conditions: RuleCondition[], category = 'equipment'): Rule {
  return { id, order, enabled: true, conditions, category, confidence: 'rule', note: '' }
}

const context = categorisationContextOf({ accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }], clients: [], settings: DEFAULT_SETTINGS })

describe('rule fields', () => {
  it('reads back as the rule they were written from', () => {
    const written = rule('every-condition', 150, [
      { column: 'direction', direction: 'debit' },
      { column: 'counterparty_iban', iban: 'XX00FAKE0000000013' },
      { column: 'has_counterparty_iban', present: true },
      { column: 'counterparty_is_own' },
      { column: 'counterparty_is_client' },
      { column: 'counterparty_contains', fragment: 'DESK' },
      { column: 'description_contains', fragment: 'CHAIR' },
      { column: 'description_starts_with', fragment: 'ORDER' },
      { column: 'tx_domain', code: 'PMNT' },
      { column: 'tx_family', code: 'ICDT' },
      { column: 'tx_sub_family', code: 'ESCT' },
      { column: 'purpose', code: 'GDSV' },
      { column: 'revenue_code', code: '0123' },
      { column: 'is_card' },
      { column: 'foreign_currency' },
    ])

    const [read] = readRules([{ fields: ruleFieldsOf(written) }], CATEGORIES).rules

    expect(read).toEqual(written)
  })

  it('applies an edit to the row with that id only when the row still holds what was read', () => {
    const rows = [{ fields: { rule: 'a', order: '100', enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }]
    const expected = rows[0]!.fields

    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'A', expected, fields: { ...expected, enabled: false } }], removed: null }).rows).toEqual([{ fields: { ...expected, enabled: false } }])
    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'a', expected: { ...expected, order: '100 ' }, fields: expected }], removed: null }).refusals).toEqual([])
    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'a', expected: { ...expected, order: '200' }, fields: expected }], removed: null }).refusals).toHaveLength(1)
    expect(rulesTabAfter(rows, { appended: { rule: 'b', note: '' }, edited: [], removed: null }).rows[1]).toEqual({ fields: { rule: 'b' } })
  })

  it('takes a removed row off only while it still holds what was read', () => {
    const kept = { fields: { rule: 'a', order: '100', enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }
    const gone = { fields: { ...kept.fields, rule: 'b', order: '200' } }

    expect(rulesTabAfter([kept, gone], { appended: null, edited: [], removed: gone.fields })).toEqual({ rows: [kept], refusals: [] })
    expect(rulesTabAfter([kept, gone], { appended: null, edited: [], removed: { ...gone.fields, note: 'typed meanwhile' } }).refusals).toEqual(['rule "b" changed since the app last read it'])
    expect(rulesTabAfter([kept], { appended: null, edited: [], removed: gone.fields }).refusals).toEqual(['no row on the rules tab has the id "b" any more'])
  })

  it('are stored without the blank fields a draft leaves, and keep a switched-off flag', () => {
    expect(RULE_CODEC.fieldsOf({ fields: { rule: 'a', order: '100', enabled: false, category: '', note: '' } })).toEqual({ rule: 'a', order: '100', enabled: false })
  })
})

describe('previewRulesChange', () => {
  const good = { fields: { rule: 'a', order: '100', enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }
  const broken = { fields: { rule: 'broken', order: 'soon', enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }

  it('refuses only the rules the change writes, and leaves a broken rule elsewhere to its problem', () => {
    const preview = (change: Parameters<typeof previewRulesChange>[1]) => previewRulesChange([good, broken], change, CATEGORIES, [], [], context).refusals

    expect(preview({ appended: { rule: 'b', order: '200', enabled: true, is_card: true, category: 'travel', confidence: 'rule' }, edited: [], removed: null })).toEqual([])
    expect(preview({ appended: null, edited: [{ id: 'a', expected: good.fields, fields: { ...good.fields, category: 'snacks' } }], removed: null })).toEqual([
      'a: it files rows as "snacks" at rule confidence, and the categories tab does not define it',
    ])
    expect(preview({ appended: null, edited: [], removed: good.fields })).toEqual([])
  })

  it('refuses a new rule without an id, and names a taken id once', () => {
    const preview = (change: Parameters<typeof previewRulesChange>[1]) => previewRulesChange([good, broken], change, CATEGORIES, [], [], context).refusals

    expect(preview({ appended: { rule: '', order: '200', enabled: true, is_card: true, category: 'travel', confidence: 'rule' }, edited: [], removed: null })).toEqual([
      'unnamed: a row without a rule id',
    ])
    expect(preview({ appended: { rule: 'a', order: '200', enabled: true, is_card: true, category: 'travel', confidence: 'rule' }, edited: [], removed: null })).toEqual([
      'a: the id is on more than one row, so none of them is tried',
    ])
  })
})

describe('rule placement', () => {
  const rules = [rule('a', 100, [], 'equipment'), rule('b', 200, [], 'equipment'), rule('c', 300, [], 'equipment')]

  it('goes halfway between its new neighbours, or a step past either end', () => {
    expect(placeBefore(rules, null, 'b')).toEqual({ order: 150, renumbered: new Map() })
    expect(placeBefore(rules, null, 'a').order).toBe(0)
    expect(placeBefore(rules, null, null).order).toBe(400)
    expect(placeBefore(rules, 'c', 'a').order).toBe(0)
  })

  it('renumbers in steps of 100 when two neighbours share an order', () => {
    const tied = [rule('a', 100, [], 'equipment'), rule('b', 100, [], 'equipment')]

    expect(placeBefore(tied, null, 'b')).toEqual({ order: 200, renumbered: new Map([['b', 300]]) })
  })

  it('swaps orders with a neighbour, so every order stays on its step', () => {
    expect(swapWithNeighbour(rules, 'b', 'earlier')).toEqual(
      new Map([
        ['b', 100],
        ['a', 200],
      ]),
    )
    expect(swapWithNeighbour(rules, 'b', 'later')).toEqual(
      new Map([
        ['b', 300],
        ['c', 200],
      ]),
    )
    expect(swapWithNeighbour(rules, 'a', 'earlier')).toBeNull()
    const tied = [rule('a', 100, [], 'equipment'), rule('b', 100, [], 'equipment')]
    expect(swapWithNeighbour(tied, 'b', 'earlier')).toEqual(new Map([['a', 200]]))
  })
})

describe('rule coverage', () => {
  it('groups the confirmed rows no rule reproduces by IBAN, else by name, largest first', () => {
    const rows = ledger([
      { date: '2026-09-01', amount: -10, counterparty: 'Desk Co', iban: 'XX00FAKE0000000013', category: 'equipment', flaggedBy: 'ivan' },
      { date: '2026-09-02', amount: -12, counterparty: 'DESK CO LTD', iban: 'XX00FAKE0000000013', category: 'travel', flaggedBy: 'ivan' },
      { date: '2026-09-03', amount: -5, counterparty: 'Corner Shop · snacks', category: 'equipment', flaggedBy: 'ivan' },
      { date: '2026-09-04', amount: -6, counterparty: 'AIRLINE CO', category: 'travel', flaggedBy: 'ivan' },
      { date: '2026-09-05', amount: -7, counterparty: 'Unknown Ltd', category: 'nope', flaggedBy: 'ivan' },
      { date: '2026-09-06', amount: -8, counterparty: 'Corner Shop', category: 'equipment', flaggedBy: 'ai' },
    ])
    const rules = [rule('airline', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel')]

    const { notCovered, exceptions } = ruleCoverage(rows, rules, context)

    expect(notCovered.map((group) => [group.key, group.name, group.rows.length, group.categories])).toEqual([
      [
        'iban:XX00FAKE0000000013',
        'DESK CO LTD',
        2,
        [
          { category: 'equipment', count: 1 },
          { category: 'travel', count: 1 },
        ],
      ],
      ['name:CORNER SHOP', 'Corner Shop', 1, [{ category: 'equipment', count: 1 }]],
    ])
    expect(exceptions).toEqual([])
  })

  it('keeps a hand-filed payment apart as an exception when a rule files the same IBAN in another category', () => {
    const accountant = 'XX00FAKE0000000014'
    const rows = ledger([
      ...Array.from({ length: 15 }, (_, month) => ({
        date: `2025-${String((month % 12) + 1).padStart(2, '0')}-20`,
        amount: -150,
        counterparty: 'Ledger & Co',
        iban: accountant,
        category: 'accounting',
        flaggedBy: 'rule',
      })),
      { date: '2026-09-21', amount: -900, counterparty: 'Ledger & Co', iban: accountant, description: 'Tax advice', category: 'consulting', flaggedBy: 'ivan' },
      { date: '2026-09-22', amount: -40, counterparty: 'Desk Co', iban: 'XX00FAKE0000000013', category: 'equipment', flaggedBy: 'ivan' },
    ])
    const rules = [rule('accountant', 100, [{ column: 'counterparty_iban', iban: accountant }], 'accounting')]

    const { notCovered, exceptions } = ruleCoverage(rows, rules, context)

    expect(notCovered.map((group) => group.key)).toEqual(['iban:XX00FAKE0000000013'])
    expect(exceptions.map((group) => [group.key, group.rows.length, group.categories, group.ruleId, group.ruleCategory])).toEqual([
      ['iban:XX00FAKE0000000014|accountant', 1, [{ category: 'consulting', count: 1 }], 'accountant', 'accounting'],
    ])
  })

  it('counts a row a review rule sends to a person as not covered, since no rule settles it', () => {
    const rows = ledger([{ date: '2026-09-01', amount: -30, counterparty: 'Laptop Store', description: 'CARD PURCHASE', category: 'equipment', flaggedBy: 'ivan' }])
    const rules = [{ ...rule('card-review', 100, [{ column: 'description_starts_with', fragment: 'CARD PURCHASE' }], 'equipment'), confidence: 'review' as const }]

    const { notCovered, exceptions } = ruleCoverage(rows, rules, context)

    expect(notCovered.map((group) => group.name)).toEqual(['Laptop Store'])
    expect(exceptions).toEqual([])
  })

  it('groups card purchases settled against the bank account by their merchants', () => {
    const settlement = 'XX00FAKE0000000003'
    const cardContext = categorisationContextOf({
      accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }],
      clients: [],
      settings: { ...DEFAULT_SETTINGS, cardSettlementIbans: [settlement] },
    })
    const rows = ledger([
      { date: '2026-04-21', amount: -12, counterparty: 'Example Bank d.d. · TRAM TICKETS,EXAMPLE.ORG', iban: settlement, category: 'travel', flaggedBy: 'ivan' },
      { date: '2026-04-22', amount: -30, counterparty: 'Example Bank d.d. · BAKERY ROW,EXAMPLE CITY', iban: settlement, category: 'equipment', flaggedBy: 'ivan' },
      { date: '2026-04-24', amount: -14, counterparty: 'Example Bank d.d. · TRAM TICKETS,EXAMPLE.ORG', iban: settlement, category: 'travel', flaggedBy: 'ivan' },
    ])

    const { notCovered } = ruleCoverage(rows, [], cardContext)

    expect(notCovered.map((group) => [group.key, group.name, group.iban, group.rows.length])).toEqual([
      ['name:TRAM TICKETS,EXAMPLE.ORG', 'TRAM TICKETS,EXAMPLE.ORG', '', 2],
      ['name:BAKERY ROW,EXAMPLE CITY', 'BAKERY ROW,EXAMPLE CITY', '', 1],
    ])
  })

  it('leaves out a confirmed row a rule already files the same way', () => {
    const rows = ledger([{ date: '2026-09-01', amount: -20, counterparty: 'AIRLINE CO', category: 'travel', flaggedBy: 'ivan' }])
    const rules = [rule('airline', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel')]

    expect(ruleCoverage(rows, rules, context)).toEqual({ notCovered: [], exceptions: [] })
  })
})

describe('rulesChangeInWords', () => {
  const fields = { rule: 'accountant', order: '200', enabled: true, counterparty_iban: 'XX00FAKE0000000014', category: 'accounting', confidence: 'rule' }
  const neighbour = { ...fields, rule: 'bank-fees', order: '100' }

  it('names an added, a switched, a moved, an edited and a deleted rule', () => {
    expect(rulesChangeInWords({ appended: fields, edited: [], removed: null })).toBe('Added accountant')
    expect(rulesChangeInWords({ appended: null, edited: [{ id: 'accountant', expected: fields, fields: { ...fields, enabled: false } }], removed: null })).toBe('Switched off accountant')
    expect(
      rulesChangeInWords({
        appended: null,
        edited: [
          { id: 'accountant', expected: fields, fields: { ...fields, order: '100' } },
          { id: 'bank-fees', expected: neighbour, fields: { ...neighbour, order: '200' } },
        ],
        removed: null,
      }),
    ).toBe('Moved accountant ahead of bank-fees')
    expect(rulesChangeInWords({ appended: null, edited: [{ id: 'accountant', expected: fields, fields: { ...fields, note: 'Monthly', category: 'consulting' } }], removed: null })).toBe(
      'Edited accountant: category, note',
    )
    expect(rulesChangeInWords({ appended: null, edited: [], removed: fields })).toBe('Deleted accountant')
  })
})

describe('verdict changes', () => {
  const [unclassified, guessed] = ledger([
    { date: '2026-09-01', amount: -10, category: 'nope', flaggedBy: 'ai' },
    { date: '2026-09-02', amount: -20, category: 'equipment', flaggedBy: 'ai', reviewReasons: ['reversal'] },
  ]).reverse()

  it('confirms only a row whose category is defined, under the review label', () => {
    expect(confirmation(unclassified!, DEFAULT_SETTINGS)).toBeNull()
    expect(confirmation(guessed!, DEFAULT_SETTINGS)).toEqual({ id: guessed!.id, verdict: { category: 'equipment', flaggedBy: 'human' } })
  })

  it('takes a confirmed row with review reasons out of the queue', () => {
    expect(needsReview({ ...guessed!, flaggedBy: 'rule' })).toBe(true)
    expect(needsReview({ ...guessed!, flaggedBy: 'ivan' })).toBe(false)
  })
})

describe('ledger key', () => {
  const desk = { account: 'main', reference: '', date: civil('2026-09-01'), amount: -10, balance: 40, description: 'Desk' }

  it('keys by account and reference when there is one, else by the booking', () => {
    expect(ledgerKeyOf(desk)).not.toBe(ledgerKeyOf({ ...desk, balance: 50 }))
    expect(ledgerKeyOf({ ...desk, reference: 'R1' })).toBe(ledgerKeyOf({ ...desk, balance: 50, reference: 'R1' }))
    expect(ledgerKeyOf({ ...desk, reference: 'R1' })).not.toBe(ledgerKeyOf({ ...desk, reference: 'R2' }))
  })
})
