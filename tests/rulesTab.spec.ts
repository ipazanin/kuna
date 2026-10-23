import { describe, expect, it } from 'vitest'

import { RULE_COLUMNS } from '../src/features/rules/domain/rule'
import { needsReview } from '../src/features/workbook/domain/needsReview'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot, WorkbookTab } from '../src/features/workbook/infrastructure/workbookSnapshot'

const HEADER = [...RULE_COLUMNS] as string[]

/** A rules tab row from the cells it fills. */
function ruleRow(cells: Partial<Record<(typeof RULE_COLUMNS)[number], CellValue>>): CellValue[] {
  return HEADER.map((column) => cells[column as keyof typeof cells] ?? '')
}

function snapshotWith(rules: CellValue[][], ledger: CellValue[][] = [['date', 'account', 'amount', 'balance']], missingTabs: WorkbookTab[] = []): WorkbookSnapshot {
  return {
    meta: { id: 'sheet', source: 'google', title: 'Books', syncedAt: '2026-10-16T08:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs },
    ledger: sheetRowsFromValues(ledger),
    categories: sheetRowsFromValues([
      ['category', 'family', 'bucket'],
      ['travel', 'operating', 'operating'],
      ['bank-fees', 'operating', 'operating'],
    ]),
    accounts: [],
    settings: [],
    rules: sheetRowsFromValues(rules),
    invoices: [],
    clients: [],
    'outgoing-plan': [],
    'owner-advances': [],
    assets: [],
    grants: [],
    'year-end': [],
    plan: [],
    scenarios: [],
    splits: [],
    dismissed: [],
  }
}

describe('reading the rules tab', () => {
  it('reads every condition kind into its folded or normalised form, in trying order', () => {
    const workbook = readSnapshot(
      snapshotWith([
        HEADER,
        ruleRow({ rule: 'b', order: 200, enabled: 'TRUE', description_starts_with: 'naknad', tx_sub_family: 'chrg', category: 'bank-fees', confidence: 'rule' }),
        ruleRow({
          rule: 'a',
          order: 100,
          enabled: true,
          direction: 'Debit',
          counterparty_iban: 'xx00 fake 0001',
          has_counterparty_iban: false,
          counterparty_is_own: true,
          counterparty_contains: 'Café',
          description_contains: 'plaća za',
          tx_domain: 'pmnt',
          tx_family: 'ccrd',
          purpose: 'loan',
          revenue_code: '1651',
          is_card: 'TRUE',
          foreign_currency: true,
          category: 'Travel',
          confidence: 'Rule',
          note: 'Why.',
        }),
      ]),
    ).workbook

    expect(workbook.problems).toEqual([])
    expect(workbook.rules.map((rule) => rule.id)).toEqual(['a', 'b'])
    expect(workbook.rules[0]).toEqual({
      id: 'a',
      order: 100,
      enabled: true,
      conditions: [
        { column: 'direction', direction: 'debit' },
        { column: 'counterparty_iban', iban: 'XX00FAKE0001' },
        { column: 'has_counterparty_iban', present: false },
        { column: 'counterparty_is_own' },
        { column: 'counterparty_contains', fragment: 'CAFE' },
        { column: 'description_contains', fragment: 'PLACA ZA' },
        { column: 'tx_domain', code: 'PMNT' },
        { column: 'tx_family', code: 'CCRD' },
        { column: 'purpose', code: 'LOAN' },
        { column: 'revenue_code', code: '1651' },
        { column: 'is_card' },
        { column: 'foreign_currency' },
      ],
      category: 'travel',
      confidence: 'rule',
      note: 'Why.',
    })
  })

  it('tries enabled rules that share an order by id, and reports the tie on each of them', () => {
    const workbook = readSnapshot(
      snapshotWith([
        HEADER,
        ruleRow({ rule: 'rule-10', order: 100, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'rule-9', order: 100, enabled: true, is_card: true, category: 'bank-fees', confidence: 'rule' }),
        ruleRow({ rule: 'parked', order: 100, enabled: false, is_card: true, category: 'travel', confidence: 'rule' }),
      ]),
    ).workbook

    expect(workbook.rules.map((rule) => rule.id)).toEqual(['parked', 'rule-9', 'rule-10'])
    expect(workbook.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['rule-9', 'shares the order 100 with rule-10, so the app tries them by id and the Apps Script by row. Give each its own order'],
      ['rule-10', 'shares the order 100 with rule-9, so the app tries them by id and the Apps Script by row. Give each its own order'],
    ])
  })

  it('reports each refusal on its row instead of failing the workbook', () => {
    const workbook = readSnapshot(
      snapshotWith([
        [...HEADER, 'colour'],
        [...ruleRow({ rule: 'odd', order: 1, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }), 'red'],
        ruleRow({ order: 2, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'same', order: 3, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'SAME', order: 4, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'first', order: 'first', enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'maybe', order: 6, enabled: 'yes', is_card: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'sure', order: 7, enabled: true, is_card: true, category: 'travel', confidence: 'certain' }),
        ruleRow({ rule: 'nope', order: 8, enabled: true, is_card: true, category: 'nope', confidence: 'rule' }),
        ruleRow({ rule: 'bare', order: 9, enabled: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'client', order: 10, enabled: true, counterparty_is_client: true, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'code', order: 11, enabled: true, revenue_code: 651, category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'side', order: 12, enabled: true, direction: 'out', is_card: 'FALSE', category: 'travel', confidence: 'rule' }),
        ruleRow({ rule: 'kept', order: 13, enabled: true, is_card: true, category: 'travel', confidence: 'rule' }),
      ], undefined, ['clients']),
    ).workbook

    expect(workbook.rules.map((rule) => rule.id)).toEqual(['kept'])
    expect(workbook.problems.map((problem) => [problem.tab, problem.label, problem.reason])).toEqual([
      ['rules', 'odd', '"colour" is not a column a rule can test'],
      ['rules', 'unnamed', 'a row without a rule id'],
      ['rules', 'same', 'the id is on more than one row, so none of them is tried'],
      ['rules', 'SAME', 'the id is on more than one row, so none of them is tried'],
      ['rules', 'first', 'the order "first" is not a number'],
      ['rules', 'maybe', 'the enabled cell "yes" is neither TRUE nor FALSE'],
      ['rules', 'sure', 'the confidence "certain" is neither rule nor review'],
      ['rules', 'nope', 'it files rows as "nope" at rule confidence, and the categories tab does not define it'],
      ['rules', 'bare', 'no condition, so it would match every row'],
      ['rules', 'client', 'it tests counterparty_is_client, and the workbook has no clients tab with client and iban columns to answer it. Add the tab, or name the client by counterparty_iban'],
      ['rules', 'code', 'revenue_code is "651", and it is four digits'],
      ['rules', 'side', 'direction is "out", and it is credit, debit or blank'],
      ['rules', 'side', 'is_card is "FALSE", and it is TRUE or blank'],
    ])
  })

  it('keeps a disabled rule after checking its id and order only, and lets a review rule name any category or none', () => {
    const workbook = readSnapshot(
      snapshotWith([
        HEADER,
        ruleRow({ rule: 'parked', order: 5, enabled: false, revenue_code: 'x', category: 'nope', confidence: 'rule' }),
        ruleRow({ rule: 'card-review', order: 1, enabled: true, is_card: true, category: 'card-purchase-unknown', confidence: 'review' }),
        ruleRow({ rule: 'guard', order: 2, enabled: true, counterparty_iban: 'XX00FAKE0002', confidence: 'review' }),
      ]),
    ).workbook

    expect(workbook.problems).toEqual([])
    expect(workbook.rules.map((rule) => [rule.id, rule.enabled, rule.category, rule.confidence, rule.conditions.length])).toEqual([
      ['card-review', true, 'card-purchase-unknown', 'review', 1],
      ['guard', true, '', 'review', 1],
      ['parked', false, 'nope', 'rule', 0],
    ])
  })

  it('reads no rules from a workbook without the tab', () => {
    expect(readSnapshot(snapshotWith([])).workbook.rules).toEqual([])
  })
})

describe('the ledger signal columns', () => {
  const workbook = readSnapshot(
    snapshotWith(
      [],
      [
        ['date', 'account', 'amount', 'balance', 'category', 'flagged_by', 'purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency', 'review_reasons'],
        [46300, 'main', -10, 90, 'travel', 'rule', ' GOVT ', 'PMNT', 'ICDT', 'NTAV', 'HR68 1651-FAKE', 'EUR', 'reversal | value date used'],
        [46299, 'main', 100, 100, 'travel', 'rule'],
      ],
    ),
  ).workbook

  it('carries O to T into the signals and U into the review reasons', () => {
    expect(workbook.transactions[0]).toMatchObject({
      signals: { purpose: 'GOVT', txDomain: 'PMNT', txFamily: 'ICDT', txSubFamily: 'NTAV', creditorReference: 'HR68 1651-FAKE', instructedCurrency: 'EUR' },
      reviewReasons: ['reversal', 'value date used'],
    })
    expect(workbook.transactions[1]).toMatchObject({
      signals: { purpose: '', txDomain: '', txFamily: '', txSubFamily: '', creditorReference: '', instructedCurrency: '' },
      reviewReasons: [],
    })
  })

  it('sends a rule-settled row with review reasons to review', () => {
    expect(workbook.transactions.map(needsReview)).toEqual([true, false])
  })
})
