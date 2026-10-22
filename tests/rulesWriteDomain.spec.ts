import { describe, expect, it } from 'vitest'

import { confirmation, recategorisation, undoOf } from '../src/features/review/domain/verdictChanges'
import { readRules } from '../src/features/rules/domain/readRules'
import { RULE_COLUMNS, newOrderTies } from '../src/features/rules/domain/rule'
import type { Rule, RuleCondition } from '../src/features/rules/domain/rule'
import { ruleCoverage } from '../src/features/rules/domain/ruleCoverage'
import { placeBefore, swapWithNeighbour } from '../src/features/rules/domain/rulePlacement'
import { ruleTabCells, rulesTabAfter } from '../src/features/rules/domain/rulesTabChange'
import { rulesTabRefusals } from '../src/features/rules/domain/rulesTabRefusals'
import { rulesChangeInWords } from '../src/features/rules/domain/ruleSummary'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import { isSameLedgerRow, ledgerRowKeyOf } from '../src/features/workbook/domain/ledgerRowKey'
import { needsReview } from '../src/features/workbook/domain/needsReview'
import { columnLetter } from '../src/shared/text/columnLetter'
import { ledger } from './fixtures/ledger'

const CATEGORIES = new Set(['equipment', 'travel', 'ai-services', 'revenue'])

function rule(id: string, order: number, conditions: RuleCondition[], category = 'equipment', sheetRow: number | null = null): Rule {
  return { id, order, enabled: true, conditions, category, confidence: 'rule', note: '', sheetRow }
}

const context = categorisationContextOf({ accounts: [{ slug: 'main', iban: 'XX00FAKE0000000001', currency: '' }], clients: [], settings: DEFAULT_SETTINGS })

describe('newOrderTies', () => {
  const card: RuleCondition[] = [{ column: 'is_card' }]

  it('refuses a change that makes two enabled rules share an order, and lets a disabled rule share one', () => {
    const before = [rule('a', 100, card), rule('b', 200, card)]

    expect(newOrderTies(before, [...before, rule('c', 200, card)])).toEqual([
      'b and c would share the order 200, and the Apps Script tries rules of one order by their row, so give each its own order',
    ])
    expect(newOrderTies(before, [...before, { ...rule('c', 200, card), enabled: false }])).toEqual([])
  })

  it('leaves alone a tie the rules had before the change', () => {
    const before = [rule('a', 100, card), rule('b', 100, card)]

    expect(newOrderTies(before, [{ ...rule('a', 100, card), category: 'travel' }, rule('b', 100, card)])).toEqual([])
    expect(newOrderTies(before, [...before, rule('c', 100, card)])).toHaveLength(1)
  })
})

describe('rulesTabRefusals, the mirror of parseRules in Rules.gs', () => {
  const header = [...RULE_COLUMNS]
  const good = { sheetRow: 2, cells: { rule: 'a', order: 100, enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }

  it('passes a tab the Apps Script reads', () => {
    expect(rulesTabRefusals(header, [good], CATEGORIES, false)).toEqual([])
  })

  it('refuses an enabled rule that tests counterparty_is_client only while the clients tab is missing, as categorisationContext does', () => {
    const asksForClients = { sheetRow: 3, cells: { rule: 'client-pays', order: 200, enabled: true, direction: 'credit', counterparty_is_client: true, category: 'equipment', confidence: 'rule' } }
    const parked = { sheetRow: 4, cells: { ...asksForClients.cells, rule: 'parked', enabled: false } }

    expect(rulesTabRefusals(header, [good, asksForClients, parked], CATEGORIES, true)).toEqual([])
    expect(rulesTabRefusals(header, [good, asksForClients, parked], CATEGORIES, false)).toEqual([
      'row 3: client-pays tests counterparty_is_client, and the workbook has no clients tab with client and iban columns to answer it. Add the tab, or name the client by counterparty_iban',
    ])
  })

  it('refuses a header no rule can test and a missing outcome column, before any row', () => {
    expect(rulesTabRefusals([...header.filter((column) => column !== 'confidence'), 'Owner'], [good], CATEGORIES, true)).toEqual([
      'column U is headed "owner", which no rule can test',
      'there is no "confidence" column',
    ])
  })

  it('refuses each row the Apps Script refuses, and leaves a disabled half-written rule alone', () => {
    const rows = [
      good,
      { sheetRow: 3, cells: { rule: 'A', order: 200, enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 4, cells: { rule: 'b', order: 'x', enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 5, cells: { rule: 'c', order: 300, enabled: 'maybe', is_card: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 6, cells: { rule: 'd', order: 400, enabled: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 7, cells: { rule: 'e', order: 500, enabled: true, is_card: true, category: 'snacks', confidence: 'rule' } },
      { sheetRow: 8, cells: { rule: 'f', order: 600, enabled: true, revenue_code: '123', category: 'equipment', confidence: 'rule' } },
      { sheetRow: 9, cells: { rule: 'g', order: 700, enabled: true, counterparty_is_client: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 10, cells: { rule: 'h', order: 800, enabled: true, is_card: false, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 11, cells: { rule: 'i', order: 900, enabled: true, is_card: true, category: 'equipment', confidence: 'sure' } },
      { sheetRow: 12, cells: { order: 1000, enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } },
      { sheetRow: 13, cells: { rule: 'parked', order: 1100, enabled: false, revenue_code: '1', category: 'snacks' } },
      { sheetRow: 14, cells: { rule: 'guard', order: 1200, enabled: true, is_card: true, confidence: 'review' } },
    ]

    expect(rulesTabRefusals(header, rows, CATEGORIES, false).map((refusal) => refusal.split(':')[0])).toEqual([
      'row 2',
      'row 3',
      'row 4',
      'row 5',
      'row 6',
      'row 7',
      'row 8',
      'row 9',
      'row 10',
      'row 11',
      'row 12',
    ])
  })
})

describe('rule cells', () => {
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

    const [read] = readRules([{ sheetRow: 7, cells: ruleTabCells(written) }], CATEGORIES, true).rules

    expect(read).toEqual({ ...written, sheetRow: 7 })
  })

  it('applies an edit to the row with that id only when the row still holds what was read', () => {
    const rows = [{ sheetRow: 2, cells: { rule: 'a', order: 100, enabled: true, is_card: true, category: 'equipment', confidence: 'rule' } }]
    const expected = rows[0]!.cells

    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'A', expected, cells: { ...expected, enabled: false } }] }, 2).rows).toEqual([
      { sheetRow: 2, cells: { ...expected, enabled: false } },
    ])
    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'a', expected: { ...expected, order: '100 ' }, cells: expected }] }, 2).refusals).toEqual([])
    expect(rulesTabAfter(rows, { appended: null, edited: [{ id: 'a', expected: { ...expected, order: 200 }, cells: expected }] }, 2).refusals).toHaveLength(1)
    expect(rulesTabAfter(rows, { appended: { rule: 'b', note: '' }, edited: [] }, 9).rows[1]).toEqual({ sheetRow: 10, cells: { rule: 'b' } })
  })
})

describe('rule placement', () => {
  const rules = [rule('a', 100, [], 'equipment', 2), rule('b', 200, [], 'equipment', 3), rule('c', 300, [], 'equipment', 4)]

  it('goes halfway between its new neighbours, or a step past either end', () => {
    expect(placeBefore(rules, null, 'b')).toEqual({ order: 150, renumbered: new Map() })
    expect(placeBefore(rules, null, 'a').order).toBe(0)
    expect(placeBefore(rules, null, null).order).toBe(400)
    expect(placeBefore(rules, 'c', 'a').order).toBe(0)
  })

  it('renumbers in steps of 100 when two neighbours share an order', () => {
    const tied = [rule('a', 100, [], 'equipment', 2), rule('b', 100, [], 'equipment', 3)]

    expect(placeBefore(tied, null, 'b')).toEqual({ order: 200, renumbered: new Map([['b', 300]]) })
  })

  it('swaps orders with a neighbour, so every order stays on its step', () => {
    expect(swapWithNeighbour(rules, 'b', 'earlier')).toEqual(new Map([['b', 100], ['a', 200]]))
    expect(swapWithNeighbour(rules, 'b', 'later')).toEqual(new Map([['b', 300], ['c', 200]]))
    expect(swapWithNeighbour(rules, 'a', 'earlier')).toBeNull()
    const tied = [rule('a', 100, [], 'equipment', 2), rule('b', 100, [], 'equipment', 3)]
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
    const rules = [rule('airline', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel', 2)]

    const { notCovered, exceptions } = ruleCoverage(rows, rules, context)

    expect(notCovered.map((group) => [group.key, group.name, group.rows.length, group.categories])).toEqual([
      ['iban:XX00FAKE0000000013', 'DESK CO LTD', 2, [{ category: 'equipment', count: 1 }, { category: 'travel', count: 1 }]],
      ['name:CORNER SHOP', 'Corner Shop', 1, [{ category: 'equipment', count: 1 }]],
    ])
    expect(exceptions).toEqual([])
  })

  it('keeps a hand-filed payment apart as an exception when a rule files the same IBAN in another category', () => {
    const accountant = 'XX00FAKE0000000014'
    const rows = ledger([
      ...Array.from({ length: 15 }, (_, month) => ({ date: `2025-${String((month % 12) + 1).padStart(2, '0')}-20`, amount: -150, counterparty: 'Ledger & Co', iban: accountant, category: 'accounting', flaggedBy: 'rule' })),
      { date: '2026-09-21', amount: -900, counterparty: 'Ledger & Co', iban: accountant, description: 'Tax advice', category: 'consulting', flaggedBy: 'ivan' },
      { date: '2026-09-22', amount: -40, counterparty: 'Desk Co', iban: 'XX00FAKE0000000013', category: 'equipment', flaggedBy: 'ivan' },
    ])
    const rules = [rule('accountant', 100, [{ column: 'counterparty_iban', iban: accountant }], 'accounting', 2)]

    const { notCovered, exceptions } = ruleCoverage(rows, rules, context)

    expect(notCovered.map((group) => group.key)).toEqual(['iban:XX00FAKE0000000013'])
    expect(exceptions.map((group) => [group.key, group.rows.length, group.categories, group.ruleId, group.ruleCategory])).toEqual([
      ['iban:XX00FAKE0000000014|accountant', 1, [{ category: 'consulting', count: 1 }], 'accountant', 'accounting'],
    ])
  })

  it('counts a row a review rule sends to a person as not covered, since no rule settles it', () => {
    const rows = ledger([{ date: '2026-09-01', amount: -30, counterparty: 'Laptop Store', description: 'CARD PURCHASE', category: 'equipment', flaggedBy: 'ivan' }])
    const rules = [{ ...rule('card-review', 100, [{ column: 'description_starts_with', fragment: 'CARD PURCHASE' }], 'equipment', 2), confidence: 'review' as const }]

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
    const rules = [rule('airline', 100, [{ column: 'counterparty_contains', fragment: 'AIRLINE' }], 'travel', 2)]

    expect(ruleCoverage(rows, rules, context)).toEqual({ notCovered: [], exceptions: [] })
  })
})

describe('rulesChangeInWords', () => {
  const cells = { rule: 'accountant', order: 200, enabled: true, counterparty_iban: 'XX00FAKE0000000014', category: 'accounting', confidence: 'rule' }
  const neighbour = { ...cells, rule: 'bank-fees', order: 100 }

  it('names an added, a switched, a moved and an edited rule', () => {
    expect(rulesChangeInWords({ appended: cells, edited: [] })).toBe('Added accountant')
    expect(rulesChangeInWords({ appended: null, edited: [{ id: 'accountant', expected: cells, cells: { ...cells, enabled: false } }] })).toBe('Switched off accountant')
    expect(
      rulesChangeInWords({
        appended: null,
        edited: [
          { id: 'accountant', expected: cells, cells: { ...cells, order: 100 } },
          { id: 'bank-fees', expected: neighbour, cells: { ...neighbour, order: 200 } },
        ],
      }),
    ).toBe('Moved accountant ahead of bank-fees')
    expect(rulesChangeInWords({ appended: null, edited: [{ id: 'accountant', expected: cells, cells: { ...cells, note: 'Monthly', category: 'consulting' } }] })).toBe(
      'Edited accountant: category, note',
    )
  })
})

describe('verdict changes', () => {
  const [unclassified, guessed] = ledger([
    { date: '2026-09-01', amount: -10, category: 'nope', flaggedBy: 'ai' },
    { date: '2026-09-02', amount: -20, category: 'equipment', flaggedBy: 'ai', reviewReasons: ['reversal'] },
  ]).reverse()

  it('confirms only a row whose category is defined, under the review label', () => {
    expect(confirmation(unclassified!, DEFAULT_SETTINGS)).toBeNull()
    expect(confirmation(guessed!, DEFAULT_SETTINGS)).toMatchObject({ from: { category: 'equipment', flaggedBy: 'ai' }, to: { category: 'equipment', flaggedBy: 'human' }, undoes: false })
  })

  it('undoes by swapping what was written with what was there, which may be undefined', () => {
    const change = recategorisation(unclassified!, 'equipment', { reviewLabel: 'ivan' })

    expect(undoOf({ changes: [{ ...change, from: { category: 'Nope', flaggedBy: 'ai' } }] })).toEqual([
      { key: change.key, from: { category: 'equipment', flaggedBy: 'ivan' }, to: { category: 'Nope', flaggedBy: 'ai' }, undoes: true },
    ])
  })

  it('takes a confirmed row with review reasons out of the queue', () => {
    expect(needsReview({ ...guessed!, flaggedBy: 'rule' })).toBe(true)
    expect(needsReview({ ...guessed!, flaggedBy: 'ivan' })).toBe(false)
  })
})

describe('ledger row key', () => {
  const [first, second] = ledger([
    { date: '2026-09-01', amount: -10, description: 'Desk' },
    { date: '2026-09-01', amount: -10, description: 'Desk', balance: 50 },
  ])

  it('matches by reference when there is one, else by the booking', () => {
    const blank = ledgerRowKeyOf({ ...first!, reference: '' })
    expect(isSameLedgerRow(blank, ledgerRowKeyOf({ ...second!, reference: '' }))).toBe(false)
    expect(isSameLedgerRow(blank, ledgerRowKeyOf({ ...first!, reference: 'R1' }))).toBe(true)
    expect(isSameLedgerRow(ledgerRowKeyOf({ ...first!, reference: 'R1' }), ledgerRowKeyOf({ ...second!, reference: 'R1' }))).toBe(true)
    expect(isSameLedgerRow(ledgerRowKeyOf({ ...first!, reference: 'R1' }), ledgerRowKeyOf({ ...first!, reference: 'R2' }))).toBe(false)
  })
})

describe('columnLetter', () => {
  it('counts A to Z, then AA', () => {
    expect([1, 9, 13, 21, 26, 27, 52, 703].map(columnLetter)).toEqual(['A', 'I', 'M', 'U', 'Z', 'AA', 'AZ', 'AAA'])
  })
})
