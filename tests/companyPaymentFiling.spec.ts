import { describe, expect, it } from 'vitest'

import { linkedEntry, linkFiling } from '../src/apps/spending/links/domain/instalmentSplit'
import { targetsFor } from '../src/apps/spending/links/domain/linkTarget'
import type { CompanyMoneyPart, LinkTarget, OwnerPaymentTarget } from '../src/apps/spending/links/domain/linkTarget'
import { companyMoneyCategoryIn } from '../src/apps/spending/categories/domain/starterCategories'
import type { Category } from '../src/apps/spending/workbook/domain/category'
import { wholeItemOf } from '../src/apps/spending/workbook/domain/rowItems'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { moneyFromAmount } from '../src/shared/money/money'
import { CATEGORIES, OTP, REVOLUT_EUR, REVOLUT_USD, category, row } from './fixtures/spending'

const on = (date: string) => parseCivilDate(date)!
const NOTES = { interest: 'Interest', difference: 'Difference from the plan' }
const PLACE = { currency: EURO, categories: CATEGORIES, language: 'en', notes: NOTES, receipt: false } as const

function payment(direction: OwnerPaymentTarget['direction'], parts: readonly [CompanyMoneyPart['kind'], number][], day = '2026-11-10'): OwnerPaymentTarget {
  const shaped = parts.map(([kind, amount]) => ({ kind, amount: moneyFromAmount(amount) }))
  return {
    kind: 'owner-payment',
    link: { app: 'company', kind: 'ledger-row', key: `${direction}-${day}`, due: null },
    day: on(day),
    amount: moneyFromAmount(parts.reduce((total, [, amount]) => total + amount, 0)),
    direction,
    ownerIban: OTP.iban,
    parts: shaped,
  }
}

const entry = (paid: StoredRow) => ({ row: paid, items: [wholeItemOf(paid, { category: paid.category, note: '', link: null, labels: [] })] })
const filedUnder = (linked: ReturnType<typeof linkedEntry>, categories: readonly Category[] = CATEGORIES) =>
  linked.entry.items.map((item) => [item.amount, item.category === null ? null : categories.find((held) => held.id === item.category)?.name])

describe('filing a row linked to a payment between your company and you', () => {
  it('never files a payment from the company under Loan principal, the way a loan record is filed', () => {
    const salary = row(OTP, '2026-11-10', 2_000, null)
    const linked = linkedEntry(entry(salary), payment('to-owner', [['salary', 2_000]]), PLACE)

    expect(filedUnder(linked)).toEqual([[accountMoneyFromAmount(2_000), 'Salary']])
    expect(linked.entry.items.every((item) => item.category !== CATEGORIES.find((held) => held.kind === 'repayment')!.id)).toBe(true)
    expect(linked.entry.row.categorisedBy).toBe('person')
    expect(linked.added).toEqual([])
  })

  it('splits a trip payout into travel allowances, costs paid back under For the company and tax-free pay under Salary, each part linked to the payment', () => {
    const trip = payment('to-owner', [
      ['travel-allowance', 300],
      ['cost-refund', 150],
      ['tax-free-pay', 100],
    ])
    const linked = linkedEntry(entry(row(OTP, '2026-11-12', 550, 'Income/Other income')), trip, PLACE, () => 'made-up-part')

    expect(filedUnder(linked)).toEqual([
      [accountMoneyFromAmount(300), 'Travel allowances'],
      [accountMoneyFromAmount(150), 'For the company'],
      [accountMoneyFromAmount(100), 'Salary'],
    ])
    expect(linked.entry.items.every((item) => item.link === trip.link && item.splitByLink)).toBe(true)
  })

  it('files rent, a profit payout and an owner loan repaid to the company under their own categories, and joins salary with other tax-free pay', () => {
    const one = (target: OwnerPaymentTarget, amount: number) => filedUnder(linkedEntry(entry(row(OTP, '2026-11-10', amount, null)), target, PLACE))
    expect(one(payment('to-owner', [['rent', 400]]), 400)).toEqual([[accountMoneyFromAmount(400), 'Rental income']])
    expect(one(payment('to-owner', [['profit-payout', 5_000]]), 5_000)).toEqual([[accountMoneyFromAmount(5_000), 'Profit payout']])
    expect(one(payment('from-owner', [['owner-loan', 500]]), -500)).toEqual([[accountMoneyFromAmount(-500), 'Loans to and from people']])
    expect(
      one(
        payment('to-owner', [
          ['salary', 1_800],
          ['tax-free-pay', 200],
        ]),
        2_000,
      ),
    ).toEqual([[accountMoneyFromAmount(2_000), 'Salary']])
  })

  it("keeps what the row moved beyond the payment under the row's category, and leaves other money such as share capital waiting for a category", () => {
    const more = linkedEntry(entry(row(OTP, '2026-11-10', 2_050, 'Income/Other income')), payment('to-owner', [['salary', 2_000]]), PLACE, () => 'made-up-part')
    expect(filedUnder(more)).toEqual([
      [accountMoneyFromAmount(2_000), 'Salary'],
      [accountMoneyFromAmount(50), 'Other income'],
    ])
    expect(more.entry.items[1]?.note).toBe(NOTES.difference)

    const capital = linkedEntry(entry(row(OTP, '2026-11-10', -2_500, 'Other/Other')), payment('from-owner', [['other', 2_500]]), PLACE)
    expect(filedUnder(capital)).toEqual([[accountMoneyFromAmount(-2_500), null]])
  })

  it('adds the category of a role a file made before roles lacks, under its Income group, and finds it once it holds the role', () => {
    const beforeRoles = CATEGORIES.filter((held) => held.role !== 'travel-allowance').map((held) => ({ ...held, role: held.role === 'salary' ? null : held.role }))
    const linked = linkedEntry(entry(row(OTP, '2026-11-10', 2_000, null)), payment('to-owner', [['salary', 2_000]]), { ...PLACE, categories: beforeRoles }, () => 'made-up-salary')

    expect(linked.added.map((added) => [added.name, added.kind, added.parent, added.role])).toEqual([['Salary', 'income', category('Income').id, 'salary']])
    expect(companyMoneyCategoryIn([...beforeRoles, ...linked.added], 'salary', 'en').added).toEqual([])
    expect(companyMoneyCategoryIn(CATEGORIES, 'travel-allowance', 'hr').category.name).toBe('Travel allowances')
  })

  it("links a transfer's leg, a receipt's row and a row on an account not in euros without changing their parts", () => {
    const target = payment('to-owner', [['salary', 2_000]])
    const paid = row(OTP, '2026-11-10', 2_000, 'Income/Salary')
    const why = (filing: ReturnType<typeof linkFiling>) => (filing.split === false ? filing.why : filing.split)
    expect([
      why(linkFiling(entry({ ...paid, pair: row(REVOLUT_EUR, '2026-11-10', -2_000, null).id }), target, PLACE)),
      why(linkFiling(entry(paid), target, { ...PLACE, receipt: true })),
      why(linkFiling(entry(paid), target, { ...PLACE, currency: REVOLUT_USD.currency })),
      why(linkFiling(entry(paid), target, PLACE)),
    ]).toEqual(['transfer-leg', 'receipt', 'not-euro', 'payment'])
  })

  it('offers a payment to a row only on a euro account whose IBAN the payment names, the way the money went, within half a month', () => {
    const targets: LinkTarget[] = [
      payment('to-owner', [['salary', 2_000]], '2026-11-10'),
      payment('from-owner', [['owner-loan', 500]], '2026-11-12'),
      payment('to-owner', [['rent', 400]], '2026-12-20'),
    ]
    const offered = (amount: number, account: { currency: typeof EURO; iban: string }) =>
      targetsFor({ date: on('2026-11-11'), amount: accountMoneyFromAmount(amount) }, account, targets).map((target) => (target.kind === 'owner-payment' ? target.parts[0]?.kind : target.kind))

    expect(offered(2_000, { currency: EURO, iban: OTP.iban.toLowerCase() })).toEqual(['salary'])
    expect(offered(-500, OTP)).toEqual(['owner-loan'])
    expect(offered(2_000, REVOLUT_EUR)).toEqual([])
    expect(offered(2_000, { currency: REVOLUT_USD.currency, iban: OTP.iban })).toEqual([])
  })
})
