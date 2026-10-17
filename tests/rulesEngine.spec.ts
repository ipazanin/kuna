import { describe, expect, it } from 'vitest'

import { categorise } from '../src/features/rules/domain/categorise'
import type { Rule, RuleCondition } from '../src/features/rules/domain/rule'
import {
  budgetRevenueCode,
  categorisationContextOf,
  foldRuleText,
  isCardTransaction,
  isForeignCurrency,
  postedCurrency,
  transactionFacts,
} from '../src/features/rules/domain/transactionFacts'
import type { CategorisableTransaction } from '../src/features/rules/domain/transactionFacts'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import { moneyFromAmount } from '../src/shared/money/money'
import { NO_SIGNALS } from './fixtures/ledger'

const OWN_IBAN = 'XX00FAKE0000000001'
const CARD_SETTLEMENT_IBAN = 'XX00FAKE0000000099'

const context = categorisationContextOf({
  accounts: [
    { slug: 'main', iban: OWN_IBAN, currency: '' },
    { slug: 'sterling', iban: 'XX00FAKE0000000002', currency: 'gbp' },
  ],
  settings: { ...DEFAULT_SETTINGS, cardSettlementIbans: [CARD_SETTLEMENT_IBAN] },
})

function row(overrides: Partial<Omit<CategorisableTransaction, 'amount' | 'signals'>> & { amount?: number; signals?: Partial<CategorisableTransaction['signals']> } = {}): CategorisableTransaction {
  return {
    account: overrides.account ?? 'main',
    amount: moneyFromAmount(overrides.amount ?? -10),
    counterparty: overrides.counterparty ?? '',
    counterpartyIban: overrides.counterpartyIban ?? '',
    description: overrides.description ?? '',
    signals: { ...NO_SIGNALS, ...overrides.signals },
  }
}

let nextOrder = 100
function rule(conditions: RuleCondition[], outcome: Partial<Rule> = {}): Rule {
  nextOrder += 100
  return {
    id: outcome.id ?? `rule-${nextOrder}`,
    order: outcome.order ?? nextOrder,
    enabled: outcome.enabled ?? true,
    conditions,
    category: outcome.category ?? 'matched',
    confidence: outcome.confidence ?? 'rule',
    note: '',
    sheetRow: outcome.sheetRow ?? nextOrder / 100,
  }
}

function matches(condition: RuleCondition, transaction: CategorisableTransaction): boolean {
  return categorise(transaction, [rule([condition])], context).category === 'matched'
}

describe('each condition', () => {
  it('direction reads the sign of the amount, and a zero amount is a debit', () => {
    expect(matches({ column: 'direction', direction: 'credit' }, row({ amount: 5 }))).toBe(true)
    expect(matches({ column: 'direction', direction: 'credit' }, row({ amount: 0 }))).toBe(false)
    expect(matches({ column: 'direction', direction: 'debit' }, row({ amount: 0 }))).toBe(true)
  })

  it('counterparty_iban compares normalised IBANs, and a blank IBAN matches none', () => {
    expect(matches({ column: 'counterparty_iban', iban: 'XX00FAKE0000000005' }, row({ counterpartyIban: 'xx00 fake 0000 0000 05' }))).toBe(true)
    expect(matches({ column: 'counterparty_iban', iban: '' }, row())).toBe(false)
  })

  it('has_counterparty_iban tests presence either way', () => {
    expect(matches({ column: 'has_counterparty_iban', present: false }, row())).toBe(true)
    expect(matches({ column: 'has_counterparty_iban', present: false }, row({ counterpartyIban: 'XX00FAKE0000000005' }))).toBe(false)
    expect(matches({ column: 'has_counterparty_iban', present: true }, row({ counterpartyIban: 'XX00FAKE0000000005' }))).toBe(true)
  })

  it('counterparty_is_own reads the accounts tab', () => {
    expect(matches({ column: 'counterparty_is_own' }, row({ counterpartyIban: OWN_IBAN }))).toBe(true)
    expect(matches({ column: 'counterparty_is_own' }, row({ counterpartyIban: 'XX00FAKE0000000005' }))).toBe(false)
  })

  it('counterparty_contains folds the name, and a blank counterparty matches no fragment', () => {
    expect(matches({ column: 'counterparty_contains', fragment: 'CAFE CORNER' }, row({ counterparty: 'Café  corner Ltd' }))).toBe(true)
    expect(matches({ column: 'counterparty_contains', fragment: '' }, row())).toBe(false)
  })

  it('description_contains and description_starts_with read the folded description', () => {
    expect(matches({ column: 'description_contains', fragment: 'PLACA ZA' }, row({ description: 'Isplata: plaća za 3/2026' }))).toBe(true)
    expect(matches({ column: 'description_starts_with', fragment: 'NAKNAD' }, row({ description: 'naknada za vođenje' }))).toBe(true)
    expect(matches({ column: 'description_starts_with', fragment: 'NAKNAD' }, row({ description: 'storno naknada' }))).toBe(false)
  })

  it('the ISO codes and the purpose compare folded', () => {
    const coded = row({ signals: { txDomain: 'pmnt', txFamily: 'ICDT', txSubFamily: ' chrg ', purpose: 'Loan' } })
    expect(matches({ column: 'tx_domain', code: 'PMNT' }, coded)).toBe(true)
    expect(matches({ column: 'tx_family', code: 'ICDT' }, coded)).toBe(true)
    expect(matches({ column: 'tx_sub_family', code: 'CHRG' }, coded)).toBe(true)
    expect(matches({ column: 'purpose', code: 'LOAN' }, coded)).toBe(true)
    expect(matches({ column: 'purpose', code: 'SALA' }, coded)).toBe(false)
  })

  it('revenue_code, is_card and foreign_currency test the derived signals', () => {
    expect(matches({ column: 'revenue_code', code: '1651' }, row({ signals: { creditorReference: 'HR68 1651-12345' } }))).toBe(true)
    expect(matches({ column: 'is_card' }, row({ counterpartyIban: CARD_SETTLEMENT_IBAN }))).toBe(true)
    expect(matches({ column: 'foreign_currency' }, row({ signals: { instructedCurrency: 'USD' } }))).toBe(true)
  })

  it('every condition of a rule must hold', () => {
    const both = rule([
      { column: 'description_contains', fragment: 'ZAKUP' },
      { column: 'direction', direction: 'debit' },
    ])
    expect(categorise(row({ description: 'zakup', amount: -1 }), [both], context).category).toBe('matched')
    expect(categorise(row({ description: 'zakup', amount: 1 }), [both], context).category).toBe('unknown')
  })
})

describe('categorise', () => {
  const fee = row({ description: 'Naknada za vođenje računa' })

  it('takes the first enabled rule by order, whatever order the list is in', () => {
    const later = rule([{ column: 'description_contains', fragment: 'NAKNADA' }], { id: 'later', order: 500, category: 'later' })
    const earlier = rule([{ column: 'description_starts_with', fragment: 'NAKNAD' }], { id: 'earlier', order: 200, category: 'bank-fees' })

    expect(categorise(fee, [later, earlier], context)).toEqual({ category: 'bank-fees', flaggedBy: 'rule', ruleId: 'earlier' })
  })

  it('breaks a tie between equal orders by tab row', () => {
    const lowerRow = rule([{ column: 'description_contains', fragment: 'NAKNADA' }], { id: 'lower', order: 100, sheetRow: 9, category: 'second' })
    const upperRow = rule([{ column: 'description_contains', fragment: 'NAKNADA' }], { id: 'upper', order: 100, sheetRow: 3, category: 'first' })

    expect(categorise(fee, [lowerRow, upperRow], context).ruleId).toBe('upper')
  })

  it('skips a disabled rule', () => {
    const parked = rule([{ column: 'description_contains', fragment: 'NAKNADA' }], { id: 'parked', order: 1, enabled: false })

    expect(categorise(fee, [parked], context)).toEqual({ category: 'unknown', flaggedBy: 'ai', ruleId: null })
  })

  it('files a review rule as ai with its category, and a blank one as unknown', () => {
    const named = rule([{ column: 'is_card' }], { id: 'card-review', category: 'card-purchase-unknown', confidence: 'review' })
    const blank = rule([{ column: 'counterparty_iban', iban: 'XX00FAKE0000000005' }], { id: 'guard', category: '', confidence: 'review' })

    expect(categorise(row({ description: '411111XXXXXX1111, SHOP' }), [named], context)).toEqual({
      category: 'card-purchase-unknown',
      flaggedBy: 'ai',
      ruleId: 'card-review',
    })
    expect(categorise(row({ counterpartyIban: 'XX00FAKE0000000005' }), [blank], context)).toEqual({ category: 'unknown', flaggedBy: 'ai', ruleId: 'guard' })
  })

  it('lets a guard row stop a multi-purpose account from falling through to a broader rule', () => {
    const owner = 'XX00FAKE0000000007'
    const rules = [
      rule([{ column: 'counterparty_iban', iban: owner }, { column: 'description_contains', fragment: 'ZAKUP' }], { id: 'owner-rent', order: 100, category: 'rent-owner' }),
      rule([{ column: 'counterparty_iban', iban: owner }], { id: 'owner-review', order: 200, category: '', confidence: 'review' }),
      rule([{ column: 'direction', direction: 'debit' }], { id: 'any-debit', order: 300, category: 'other-costs' }),
    ]

    expect(categorise(row({ counterpartyIban: owner, description: 'Zakup 3/2026' }), rules, context).ruleId).toBe('owner-rent')
    expect(categorise(row({ counterpartyIban: owner, description: 'something else' }), rules, context).ruleId).toBe('owner-review')
  })
})

describe('the derived signals', () => {
  it('folds as the Apps Script does, keeping đ', () => {
    expect(foldRuleText('  Plaća  za\tvođenje ')).toBe('PLACA ZA VOĐENJE')
  })

  it('reads the revenue code from the creditor reference, else from the head of the description only', () => {
    expect(budgetRevenueCode('HR68 8168-0000', '')).toBe('8168')
    expect(budgetRevenueCode('hr68 1880-2026-1', '')).toBe('1880')
    expect(budgetRevenueCode('', '1651 POR.NA DOBIT')).toBe('1651')
    expect(budgetRevenueCode('', 'PONUDA 2154-2025-800')).toBe('')
    expect(budgetRevenueCode('HR00 ABC', '16510 X')).toBe('')
  })

  it('knows a card purchase by its ISO code, the settlement account, a masked card number or a PDF card line', () => {
    expect(isCardTransaction({ txDomain: 'PMNT', txFamily: 'CCRD' }, '', '', context)).toBe(true)
    expect(isCardTransaction({ txDomain: 'pmnt', txFamily: 'CCRD' }, '', '', context)).toBe(false)
    expect(isCardTransaction(NO_SIGNALS, CARD_SETTLEMENT_IBAN, '', context)).toBe(true)
    expect(isCardTransaction(NO_SIGNALS, '', '411111XXXXXX1111, SHOP', context)).toBe(true)
    expect(isCardTransaction(NO_SIGNALS, '', 'POS KUPOVINA/10.12/EUR/1,00', context)).toBe(true)
    expect(isCardTransaction(NO_SIGNALS, '', 'TRANSFER', context)).toBe(false)
  })

  it('compares the instructed or posted currency with the account currency', () => {
    expect(isForeignCurrency({ instructedCurrency: 'usd' }, '', 'EUR')).toBe(true)
    expect(isForeignCurrency({ instructedCurrency: 'EUR' }, '', 'EUR')).toBe(false)
    expect(isForeignCurrency({ instructedCurrency: '' }, 'POS KUPOVINA/10.12/GBP/824,85', 'EUR')).toBe(true)
    expect(isForeignCurrency({ instructedCurrency: '' }, 'POS KUPOVINA/10.12/GBP/824,85', 'GBP')).toBe(false)
    expect(isForeignCurrency({ instructedCurrency: '' }, 'GBP SHOP', 'EUR')).toBe(false)
    expect(postedCurrency('POS KUPOVINA/1.12/GBP/1')).toBe('')
  })

  it('takes the currency of the row’s account, else the workbook’s', () => {
    const paidInPounds = { signals: { instructedCurrency: 'GBP' } }
    expect(transactionFacts(row({ account: 'sterling', ...paidInPounds }), context).foreignCurrency).toBe(false)
    expect(transactionFacts(row({ account: 'main', ...paidInPounds }), context).foreignCurrency).toBe(true)
  })

  it('works out own account and IBAN presence once per row', () => {
    expect(transactionFacts(row({ counterpartyIban: OWN_IBAN }), context)).toMatchObject({ ownAccount: true, hasCounterpartyIban: true })
    expect(transactionFacts(row(), context)).toMatchObject({ ownAccount: false, hasCounterpartyIban: false })
  })
})
