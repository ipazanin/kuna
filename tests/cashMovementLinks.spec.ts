import { describe, expect, it } from 'vitest'

import { cashMovementTargetsOf } from '../src/apps/investments/transactions/application/publishedCashMovements'
import { investmentTargetsFrom } from '../src/apps/spending/links/application/investmentTargets'
import { CASH_MOVEMENT_NEAR, arrivedBeyond, cashMovementOffers, nearInEuros } from '../src/apps/spending/links/domain/cashMovementOffers'
import { linkFiling, linkedEntry } from '../src/apps/spending/links/domain/linkFiling'
import { CASH_MOVEMENT_DAYS, mayAddToCompany, movedInTime, startingCostCategory, targetsFor } from '../src/apps/spending/links/domain/linkTarget'
import type { CashMovementTarget, LinkTarget } from '../src/apps/spending/links/domain/linkTarget'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { linkLineOf } from '../src/apps/spending/links/presentation/linkLine'
import { addDays, parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { writtenPercent } from '../src/shared/money/percent'
import { BROKER, USD, book, cashMovement } from './fixtures/investments'
import { INVESTMENTS_DOCUMENT } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { fakeInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/fake/fakeInvestments'
import { reviewCount } from '../src/apps/spending/statements/domain/reviewQueue'
import { SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { fakeSpendingDocument } from '../src/apps/spending/workbook/infrastructure/fake/fakeSpending'
import { CATEGORIES, OTP, REVOLUT_USD, category, row, spendingBook } from './fixtures/spending'

const on = (date: string) => parseCivilDate(date)!
const NOTES = { interest: 'Interest', difference: 'Difference from the plan' }
const PLACE = { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false } as const

function movement(kind: CashMovementTarget['movement'], day: string, euros: number, key = `${kind}-${day}`): CashMovementTarget {
  return { kind: 'cash-movement', link: { app: 'investments', kind: 'cash-movement', key, due: null }, accountName: 'IBKR', day: on(day), movement: kind, amount: moneyFromAmount(euros) }
}

const entry = (paid: StoredRow) => ({ row: paid, items: [wholeItemOf(paid, { category: paid.category, note: '', link: null, labels: [] })] })

describe('which rows may be a deposit or a withdrawal of a broker account', () => {
  it('takes 2 percent of the movement as the most the euros may differ, and a week as the most the money may take', () => {
    expect([writtenPercent(CASH_MOVEMENT_NEAR), CASH_MOVEMENT_DAYS]).toEqual([2, 7])
  })

  it.each([
    ['exactly 2 percent more', -1_020, true],
    ['just over 2 percent more', -1_020.01, false],
    ['exactly 2 percent less', -980, true],
    ['just over 2 percent less', -979.99, false],
    ['the same euros', -1_000, true],
  ])('compares a row of %s than a deposit of 1,000.00', (_, amount, near) => {
    expect(nearInEuros(movement('deposit', '2026-06-04', 1_000), row(OTP, '2026-06-02', amount, null))).toBe(near)
  })

  it.each([
    ['the row day', 'deposit', -1_000, 0, true],
    ['7 days after the row', 'deposit', -1_000, 7, true],
    ['8 days after the row', 'deposit', -1_000, 8, false],
    ['the day before the row', 'deposit', -1_000, -1, false],
    ['money in on a deposit day', 'deposit', 1_000, 0, false],
    ['7 days before the row', 'withdrawal', 1_000, -7, true],
    ['8 days before the row', 'withdrawal', 1_000, -8, false],
    ['the day after the row', 'withdrawal', 1_000, 1, false],
    ['money out on a withdrawal day', 'withdrawal', -1_000, 0, false],
  ] as const)('reads a %s %s', (_, kind, amount, days, fits) => {
    const paid = row(OTP, '2026-06-10', amount, null)
    expect(movedInTime(paid, movement(kind, addDays(on('2026-06-10'), days), 1_000))).toBe(fits)
  })

  it('lists the deposits money out may pay in the picker, nearest first, and no withdrawal', () => {
    const targets: readonly LinkTarget[] = [
      movement('deposit', '2026-06-08', 500),
      movement('deposit', '2026-06-03', 997.68),
      movement('withdrawal', '2026-06-02', 1_000),
      movement('deposit', '2026-06-20', 1_000),
    ]
    expect(targetsFor(row(OTP, '2026-06-02', -1_000, null), OTP, targets).map((target) => (target.kind === 'cash-movement' ? target.day : null))).toEqual([on('2026-06-03'), on('2026-06-08')])
  })
})

describe('what arrived at or from the broker', () => {
  it('says how much less arrived at the broker for a deposit, and how much less came back for a withdrawal', () => {
    expect(arrivedBeyond(movement('deposit', '2026-06-04', 997.68), { amount: accountMoneyFromAmount(-1_000) }, EURO)).toBe(accountMoneyFromAmount(-2.32))
    expect(arrivedBeyond(movement('withdrawal', '2026-06-04', 500), { amount: accountMoneyFromAmount(497.5) }, EURO)).toBe(accountMoneyFromAmount(-2.5))
    expect(arrivedBeyond(movement('deposit', '2026-06-04', 997.68), { amount: accountMoneyFromAmount(-1_000) }, REVOLUT_USD.currency)).toBeNull()
  })

  it('names the broker account and the difference on the link line, with no direction of its own', () => {
    const deposit = movement('deposit', '2026-06-04', 997.68)
    const line = linkLineOf(deposit.link, [{ ...deposit, to: '/investments/transactions' }], 'investments', { amount: accountMoneyFromAmount(-1_000), currency: EURO, bought: false })
    expect([line.text, line.look]).toEqual(['Deposit to IBKR, 4 Jun 2026, €2.32 less arrived', 'there'])
  })
})

describe('filing a row linked to a deposit or a withdrawal', () => {
  it('files a row with no category whole under Saved to investments', () => {
    const linked = linkedEntry(entry(row(OTP, '2026-06-02', -1_000, null)), movement('deposit', '2026-06-04', 997.68), PLACE)
    expect(linked.entry.items.map((item) => [item.amount, item.category, item.link?.kind])).toEqual([[accountMoneyFromAmount(-1_000), category('Saved to investments').id, 'cash-movement']])
    expect(linked.entry.row.categorisedBy).toBe('person')
  })

  it('keeps the category of a row filed already, so no figure moves', () => {
    const filed = entry(row(OTP, '2026-06-02', -1_000, 'Food/Groceries'))
    const deposit = movement('deposit', '2026-06-04', 997.68)
    expect(linkFiling(filed, deposit, PLACE)).toEqual({ split: false, why: 'kept' })
    expect(linkedEntry(filed, deposit, PLACE).entry.items.map((item) => [item.amount, item.category])).toEqual([[accountMoneyFromAmount(-1_000), category('Food/Groceries').id]])
  })
})

describe('the rows To review offers as deposits and withdrawals', () => {
  const waiting = row(OTP, '2026-06-02', -1_000, null, { payee: 'Example Broker' })
  const saved = row(OTP, '2026-06-10', -500, 'Saved to investments', { payee: 'Example Broker' })
  const groceries = row(OTP, '2026-06-12', -300, 'Food/Groceries')

  it('matches a waiting row to the nearest movement no row is linked to, and leaves out a row filed under Saved to investments or elsewhere', () => {
    const offers = cashMovementOffers(spendingBook([waiting, saved, groceries]), [
      movement('deposit', '2026-06-06', 1_000),
      movement('deposit', '2026-06-04', 997.68),
      movement('deposit', '2026-06-12', 500),
      movement('deposit', '2026-06-13', 300),
    ])
    expect(offers.map(({ row: paid, target, difference }) => [paid.id, target.day, difference])).toEqual([[waiting.id, on('2026-06-04'), accountMoneyFromAmount(-2.32)]])
  })

  it('leaves the deposit to a waiting row when a row filed under Saved to investments on an earlier day has the same euros', () => {
    const filedEarlier = row(OTP, '2026-06-01', -1_000, 'Saved to investments', { payee: 'Example Broker' })
    const offers = cashMovementOffers(spendingBook([filedEarlier, waiting]), [movement('deposit', '2026-06-04', 1_000)])
    expect(offers.map(({ row: paid }) => paid.id)).toEqual([waiting.id])
  })

  it('offers no movement a row is linked to already, and takes each movement once', () => {
    const deposit = movement('deposit', '2026-06-04', 1_000)
    const linked = row(OTP, '2026-06-01', -1_000, 'Saved to investments', { link: deposit.link })
    expect(cashMovementOffers(spendingBook([linked, waiting]), [deposit])).toEqual([])
    const twin = row(OTP, '2026-06-03', -1_000, null)
    expect(cashMovementOffers(spendingBook([waiting, twin]), [deposit]).map(({ row: paid }) => paid.id)).toEqual([waiting.id])
  })
})

describe('the deposits and withdrawals Investments publishes', () => {
  it('gives each deposit and withdrawal with its account and its euros at its own rate, and leaves out fees and fee refunds', () => {
    const published = cashMovementTargetsOf(
      book({
        accounts: [BROKER],
        cashMovements: [
          cashMovement('deposit', BROKER, '2026-06-04', '1162.30', USD, '1.165'),
          cashMovement('fee', BROKER, '2026-06-05', '5.00'),
          cashMovement('fee-refund', BROKER, '2026-06-06', '5.00'),
          cashMovement('withdrawal', BROKER, '2026-06-07', '500.00'),
        ],
      }),
    )
    expect(published.map(({ accountName, day, kind, euros, link }) => [accountName, day, kind, euros, link.app, link.kind])).toEqual([
      ['Broker', on('2026-06-04'), 'deposit', moneyFromAmount(997.68), 'investments', 'cash-movement'],
      ['Broker', on('2026-06-07'), 'withdrawal', moneyFromAmount(500), 'investments', 'cash-movement'],
    ])
    const [shown] = investmentTargetsFrom([{ app: 'investments', movements: published }])
    expect(Array.isArray(shown?.targets) ? shown.targets.map((target) => target.kind) : shown?.targets).toEqual(['cash-movement', 'cash-movement'])
  })
})

describe('which entries Spending may add to Company as a cost you paid', () => {
  it.each([
    ['money out of a euro account with no link', -45, EURO, false, true],
    ['money in', 45, EURO, false, false],
    ['money out of a dollar account', -45, REVOLUT_USD.currency, false, false],
    ['money out already linked', -45, EURO, true, false],
  ])('reads %s', (_, amount, currency, linked, may) => {
    const items = [{ link: linked ? movement('deposit', '2026-06-04', 45).link : null }]
    expect(mayAddToCompany({ amount: accountMoneyFromAmount(amount) }, currency, items)).toBe(may)
  })
})

describe('the category a cost added to Company starts with', () => {
  const categories = [
    { name: 'Office supplies', slug: 'office' },
    { name: 'Travel', slug: 'travel' },
  ]

  it("takes that of Company's newest cost you paid, else the one the payee names, else none", () => {
    const advances = [
      { day: on('2026-09-01'), categoryName: 'Office supplies' },
      { day: on('2026-10-01'), categoryName: 'Travel' },
    ]
    expect(startingCostCategory(categories, advances, 'Corner market')?.slug).toBe('travel')
    expect(startingCostCategory(categories, [], 'OFFICE SUPPLIES SHOP')?.slug).toBe('office')
    expect(startingCostCategory(categories, [{ day: on('2026-10-01'), categoryName: 'Gone since' }], 'Corner market')).toBeNull()
  })
})

describe("the fake build's broker set", () => {
  it.each(['2026-11-04', '2026-12-01', '2027-03-01'])('offers its waiting transfer the fake Investments deposit two days later, with 2.32 less arrived, on %s', (day) => {
    const savedAt = `${day}T09:00:00.000Z`
    const meta = { id: 'fake', source: 'browser' as const, title: 'Fake', syncedAt: savedAt, lastExportedAt: null, unexportedSince: null }
    const spending = SPENDING_DOCUMENT.read({ meta, revision: '1', document: fakeSpendingDocument(savedAt, 'broker', on(day)) }).workbook
    const investments = INVESTMENTS_DOCUMENT.read({ meta, revision: '1', document: fakeInvestmentsDocument(savedAt, 'sample', on(day)) }).workbook
    const targets = investmentTargetsFrom([{ app: 'investments', movements: cashMovementTargetsOf(investments.book) }]).flatMap(({ targets: shown }) => (Array.isArray(shown) ? shown : []))
    const offers = cashMovementOffers(spending, targets)

    expect(offers.map(({ row: paid, target, difference }) => [paid.payee, target.accountName, target.day, difference])).toEqual([
      ['Example Broker', 'Broker Two', addDays(on(day), -4), accountMoneyFromAmount(-2.32)],
    ])
    expect(reviewCount(spending)).toBe(1)
  })
})
