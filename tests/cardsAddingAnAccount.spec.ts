import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { INSTRUMENT_STEPS } from '../src/apps/investments/assistant/operations/instrumentOperations'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import { assetsDesk } from './fixtures/assetsDesk'
import { companyDesk } from './fixtures/companyDesk'
import { investmentsDesk } from './fixtures/investmentsDesk'
import { loansDesk } from './fixtures/loansDesk'
import { spendingDesk } from './fixtures/spendingDesk'
import { forgetCaches } from './fixtures/writeBack'

/** An IBAN no account of the Company desk holds. */
const NEW_IBAN = 'HR1210010051863000160'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** What one field shows on each line of the last card's groups of a noun, null where the line leaves it off. */
function shownOn(cards: readonly CheckedProposal[], noun: string, field: string): readonly (string | null)[] {
  return cards
    .at(-1)!
    .groups.filter((group) => group.noun.en.one === noun)
    .flatMap((group) => group.lines)
    .map((line) => line.fields.find((candidate) => candidate.name === field)?.after ?? null)
}

describe('a card that adds an account and what goes on it', () => {
  it('shows each Spending entry in the new account’s currency', async () => {
    const desk = await spendingDesk(used)
    const answer = await desk.propose([
      { op: 'add-account', input: { name: 'Dollars', kind: 'bank', bank: null, currency: 'USD', opening: 0, openedOn: '2026-11-01', iban: null }, as: '$dollars' },
      { op: 'add-entry', input: { account: '$dollars', date: '2026-11-02', amount: -12.5, payee: 'A shop', category: null, note: '' } },
      { op: 'add-entry', input: { account: '$dollars', date: '2026-11-03', amount: 40, payee: 'A refund', category: null, note: '' } },
    ])
    expect(answer.isError, answer.text).toBe(false)
    expect(shownOn(desk.cards, 'entry', 'Amount')).toEqual(['−$12.50', '$40.00'])
  })

  it('shows each Investments trade, deposit and price in the new instrument’s currency', async () => {
    const desk = await investmentsDesk(used)
    const instrument = INSTRUMENT_STEPS.operations.find((operation) => operation.name === 'add-instrument')!.example
    const answer = await desk.propose([
      { op: 'add-account', input: { name: 'New broker', note: '' }, as: '$broker' },
      { op: 'add-instrument', input: { ...instrument, name: 'Dollar ETF', symbol: 'DLR', currency: 'USD' }, as: '$etf' },
      { op: 'add-holding', input: { account: '$broker', instrument: '$etf', date: '2026-10-01', quantity: '10', price: '9.5', fees: '1', rate: '1.08', note: '' } },
      { op: 'add-price', input: { instrument: '$etf', date: '2026-10-20', price: '10.25', note: '' } },
    ])
    expect(answer.isError, answer.text).toBe(false)
    expect(shownOn(desk.cards, 'trade', 'Price')).toEqual(['$9.50'])
    expect(shownOn(desk.cards, 'trade', 'Fees')).toEqual(['$1.00'])
    expect(shownOn(desk.cards, 'cash movement', 'Amount')).toEqual(['$96.00'])
    expect(shownOn(desk.cards, 'price', 'Price')).toEqual(['$10.25'])
  })

  it('shows each Loans movement of a new informal loan', async () => {
    const desk = await loansDesk(used)
    const answer = await desk.propose([
      {
        op: 'add-informal-loan',
        input: { name: 'From Marko', counterparty: 'Marko', direction: 'you-owe', openingBalance: 500, start: '2026-10-01', note: '', expectedMonthly: null, expectedFrom: null, expectedDay: null },
        as: '$marko',
      },
      { op: 'add-movement', input: { loan: '$marko', date: '2026-10-15', kind: 'repaid', amount: 200, note: '' } },
    ])
    expect(answer.isError, answer.text).toBe(false)
    expect(shownOn(desk.cards, 'movement', 'Amount')).toEqual(['€200.00'])
  })

  it('shows each Assets valuation of a new asset', async () => {
    const desk = await assetsDesk(used)
    const answer = await desk.propose([
      { op: 'add-asset', input: { name: 'Boat', kind: 'other', bought: '2025-05-10', price: 9000, region: null, firstRegistration: null, loan: null, note: '' }, as: '$boat' },
      { op: 'add-valuation', input: { asset: '$boat', date: '2026-06-01', value: 8000, note: '' } },
    ])
    expect(answer.isError, answer.text).toBe(false)
    expect(shownOn(desk.cards, 'valuation', 'Value')).toEqual(['€8,000.00'])
  })

  it('shows each Company row of a held statement that adds its account', async () => {
    const statement = transcribedStatement(
      '',
      'fresh-statement-001',
      moneyFromAmount(200),
      moneyFromAmount(137.5),
      [
        { date: parseCivilDate('2026-10-20')!, amount: moneyFromAmount(-50), counterparty: 'Supplier', counterpartyIban: '', description: 'Goods' },
        { date: parseCivilDate('2026-10-21')!, amount: moneyFromAmount(-12.5), counterparty: 'Paper shop', counterpartyIban: '', description: 'Paper' },
      ],
      'ask',
    )
    const desk = await companyDesk(used, { heldStatements: () => [{ statement, newAccount: { iban: NEW_IBAN, currency: 'EUR' } }] })
    const answer = await desk.propose([{ op: 'file-held-statements', input: { newAccount: 'business', part: 1 } }])
    expect(answer.isError, answer.text).toBe(false)
    expect(shownOn(desk.cards, 'account', 'IBAN')).toEqual([NEW_IBAN])
    expect(shownOn(desk.cards, 'ledger row', 'Amount')).toEqual(['−€12.50', '−€50.00'])
  })
})
