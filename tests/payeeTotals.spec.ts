import { describe, expect, it } from 'vitest'

import { payeeKey, samePayee } from '../src/apps/spending/payees/domain/payeeKey'
import { inPeriod, periodNamed } from '../src/apps/spending/payees/domain/payeePeriod'
import { payeeTotals, payeesRanked } from '../src/apps/spending/payees/domain/payeeTotals'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import { ITEM_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { NO_RATES } from '../src/shared/money/rateBook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, category, row, transactionId, wholeItems } from './fixtures/spending'

describe('who a payee is', () => {
  it('folds case, accents and spaces, and nothing more', () => {
    expect(samePayee('Café on the square', ' CAFE ON  THE SQUARE ')).toBe(true)
    expect(samePayee('Đuro', 'duro')).toBe(true)
    expect(samePayee('Corner market 12', 'Corner market 14')).toBe(false)
    expect(payeeKey('   ')).toBe('')
  })
})

describe('the periods of the Payees tab', () => {
  it('count whole months up to the month of the day, and open on twelve months', () => {
    const day = civil('2026-11-04')

    expect(inPeriod('month', day)(civil('2026-11-30'))).toBe(true)
    expect(inPeriod('month', day)(civil('2026-10-31'))).toBe(false)
    expect(inPeriod('year', day)(civil('2025-12-01'))).toBe(true)
    expect(inPeriod('year', day)(civil('2025-11-30'))).toBe(false)
    expect(inPeriod('all', day)(civil('2001-01-01'))).toBe(true)
    expect([periodNamed('month'), periodNamed('all'), periodNamed(undefined), periodNamed('week')]).toEqual(['month', 'all', 'year', 'year'])
  })
})

describe("payees' totals", () => {
  const [outLeg, inLeg] = [transactionId(71), transactionId(72)]
  const dinner = row(OTP, '2026-10-12', -60, 'Food/Eating out', { payee: 'Ana Example', counterpartyIban: 'HR12 1001 0051 8630 0016 0' })
  const share = row(OTP, '2026-10-14', 30, 'Food/Eating out', { payee: 'ana example' })
  const rent = row(OTP, '2026-10-20', 400, 'Income/Other income', { payee: 'Ana Example', counterpartyIban: 'HR9923400091110000000' })
  const lent = row(OTP, '2026-10-21', -100, 'Loans to and from people', { payee: 'Ana Example' })
  const waiting = row(OTP, '2026-10-22', -15, null, { payee: 'Ana Example' })
  const topUp = row(OTP, '2026-10-01', -200, 'Between my accounts', { id: outLeg, payee: 'Top-up', pair: inLeg })
  const topUpIn = row(REVOLUT_EUR, '2026-10-01', 200, 'Between my accounts', { id: inLeg, payee: 'Top-up', pair: outLeg })
  const broker = row(OTP, '2026-10-25', -300, 'Saved to investments', { payee: 'Example Broker' })
  const nameless = row(OTP, '2026-10-26', -9, 'Food/Groceries')
  // 32.40 USD is 30 EUR at the 1.08 of 10 October.
  const market = row(REVOLUT_USD, '2026-10-10', -32.4, 'Food/Groceries', { payee: 'Corner market' })
  const parts: readonly TransactionItem[] = [
    { ...wholeItems([market])[0]!, amount: accountMoneyFromAmount(-21.6) },
    { ...wholeItems([market])[0]!, id: recordIdOf(ITEM_RECORDS, 'market-part'), amount: accountMoneyFromAmount(-10.8), category: category('Between my accounts').id },
  ]
  const transactions = [topUp, topUpIn, market, dinner, share, rent, lent, waiting, broker, nameless]
  const items = [...wholeItems(transactions.filter((entry) => entry !== market)), ...parts]
  const totals = payeeTotals(euroRows({ accounts: ACCOUNTS, transactions, items }, RATES), CATEGORIES)

  it('count only money filed under spending and income, as Overview does: a refund lowers what was paid', () => {
    const ana = totals.find((payee) => payee.key === payeeKey('Ana Example'))!

    // 60 dinner less 30 paid back. The 100 lent and the 15 waiting on review count nowhere.
    expect([ana.spent, ana.income, ana.rows, ana.latest]).toEqual([euros(30), euros(400), 3, civil('2026-10-20')])
  })

  it('name a payee as their newest row spells it, with the IBANs their rows carry, newest first', () => {
    const ana = totals.find((payee) => payee.key === payeeKey('Ana Example'))!

    expect(ana.name).toBe('Ana Example')
    expect(ana.ibans).toEqual(['HR9923400091110000000', 'HR1210010051863000160'])
  })

  it('leave out moves between your accounts, savings, and rows with no payee, and list the rest by name', () => {
    expect(totals.map((payee) => payee.name)).toEqual(['Ana Example', 'Corner market'])
  })

  it('count a split row once, at the part that counts', () => {
    const market = totals.find((payee) => payee.name === 'Corner market')!

    // Two thirds of the row's 30 EUR is spending, and the third filed as a transfer counts nowhere.
    expect([market.spent, market.rows]).toEqual([euros(20), 1])
  })

  it('count a row the rates do not reach as nothing and say so', () => {
    const market = payeeTotals(euroRows({ accounts: ACCOUNTS, transactions, items }, NO_RATES), CATEGORIES).find((payee) => payee.name === 'Corner market')!

    expect([market.spent, market.rows, market.unrated]).toEqual([euros(0), 1, 1])
  })
})

describe('payees ranked on a side', () => {
  const shops = Array.from({ length: 12 }, (_, place) => row(OTP, '2026-10-05', -(place + 1), 'Food/Groceries', { payee: `Shop ${place + 1}` }))
  const totals = payeeTotals(euroRows({ accounts: ACCOUNTS, transactions: shops, items: wholeItems(shops) }, RATES), CATEGORIES)

  it('show the ten largest and the rest as one line', () => {
    const ranked = payeesRanked(totals, 'paid')

    expect(ranked.top.map((payee) => payee.name)).toEqual(['Shop 12', 'Shop 11', 'Shop 10', 'Shop 9', 'Shop 8', 'Shop 7', 'Shop 6', 'Shop 5', 'Shop 4', 'Shop 3'])
    expect(ranked.rest).toEqual({ payees: 2, sum: euros(3) })
  })

  it('leave a side empty when no payee is above zero on it', () => {
    expect(payeesRanked(totals, 'received')).toEqual({ top: [], rest: null })
  })
})
