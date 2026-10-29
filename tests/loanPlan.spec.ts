import { describe, expect, it } from 'vitest'

import {
  balanceOn,
  interestOf,
  nextPayment,
  paidSoFar,
  paymentOf,
  paymentsAfter,
  paymentsByYear,
  payoffDate,
  principalOf,
  splitOf,
  subsidyShareOf,
  yourPrincipalOf,
  yourShareOf,
} from '../src/apps/loans/bankLoans/domain/loanFigures'
import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import type { PlanRow } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { annuity, monthlyInterest, rateOfText, rateText } from '../src/apps/loans/bankLoans/domain/yearlyRate'
import { sumMoney } from '../src/shared/money/money'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, extraPayment, lateInstalment, percent, ratePeriod } from './fixtures/loans'

/** Each row as date, payment, principal, interest and balance in euros, for reading against a worked table. */
function table(rows: readonly PlanRow[]): [string, number, number, number, number][] {
  return rows.map((row) => [row.date, row.payment / 100, row.principal / 100, row.interest / 100, row.balance / 100])
}

describe('yearly rates', () => {
  it('reads a percent with up to four decimals into exact millionths and writes it back in its shortest form', () => {
    expect(rateOfText('3.18')).toBe(31_800)
    expect(rateOfText('2.143')).toBe(21_430)
    expect(rateOfText('3.1825')).toBe(31_825)
    expect(rateOfText('0')).toBe(0)
    expect(rateText(percent('4.2500'))).toBe('4.25')
    expect(rateText(percent('4'))).toBe('4')
    expect(rateText(percent('0.05'))).toBe('0.05')
  })

  it('refuses text that is not a percent the app can hold exactly', () => {
    expect(rateOfText('3.18%')).toBeNull()
    expect(rateOfText('3,18')).toBeNull()
    expect(rateOfText('3.18251')).toBeNull()
    expect(rateOfText('-1')).toBeNull()
    expect(rateOfText('')).toBeNull()
  })

  it("works out a month's interest and an annuity to the cent", () => {
    // 100,000.00 × 3.18% / 12 = 265.00. 1,200.00 × 12% / 12 = 12.00.
    expect(monthlyInterest(euros(100_000), percent('3.18'))).toBe(euros(265))
    expect(monthlyInterest(euros(1200), percent('12'))).toBe(euros(12))
    // 1,200.00 × 0.01 × 1.01^12 / (1.01^12 − 1) = 13.5219 / 0.126825 = 106.6185, so 106.62.
    expect(annuity(euros(1200), percent('12'), 12)).toBe(euros(106.62))
    // At no interest the instalment is the balance over the count: 1,000.00 / 3 = 333.33.
    expect(annuity(euros(1000), percent('0'), 3)).toBe(euros(333.33))
  })
})

describe("a bank loan's plan", () => {
  it("reproduces HPB's published APN example: 100,000.00 at 3.18% over 360 months", () => {
    const loan = bankLoan({ principal: euros(100_000), drawdown: civil('2023-01-01'), firstInstalment: civil('2023-02-01'), instalments: 360 })
    const plan = loanPlan(loan, [ratePeriod(loan, '2023-02-01', '3.18')], [])

    // The annuity rounds to 431.37. Month 1 is 265.00 interest and 166.37 principal.
    expect(table(plan.slice(0, 1))).toEqual([['2023-02-01', 431.37, 166.37, 265, 99_833.63]])
    expect(plan.slice(0, -1).every((row) => row.payment === euros(431.37))).toBe(true)
    // The last instalment takes the 432.42 left plus its 1.15 interest, 433.57.
    expect(table(plan.slice(-1))).toEqual([['2053-01-01', 433.57, 432.42, 1.15, 0]])
    // 359 × 431.37 + 433.57 − 100,000.00 = 55,295.40, the total interest HPB prints.
    expect(sumMoney(plan.map((row) => row.interest))).toBe(euros(55_295.4))
    expect(sumMoney(plan.map((row) => row.principal))).toBe(euros(100_000))
  })

  it('puts the interim interest the bank charged before the first instalment, leaving the balance alone', () => {
    const loan = bankLoan({ interimInterest: { amount: euros(12.4), date: civil('2026-02-05') } })
    const [interim, first] = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [])

    expect(interim).toMatchObject({ kind: 'interim-interest', date: '2026-02-05', number: null, payment: euros(12.4), principal: 0, interest: euros(12.4), balance: euros(1200) })
    expect(first).toMatchObject({ kind: 'instalment', number: 1, payment: euros(106.62) })
  })

  it('recomputes the instalment on the balance over the instalments left when the rate changes, keeping the end', () => {
    const loan = bankLoan()
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12'), ratePeriod(loan, '2026-08-05', '6')], [])

    // Six instalments of 106.62 at 1% a month leave 617.89. At 0.5% a month over the 6 left the
    // annuity is 617.89 × 0.005 × 1.005^6 / (1.005^6 − 1) = 104.79. Instalment 7's interest is
    // 617.89 × 0.5% = 3.09. The last takes the 104.28 left plus 0.52 interest, 104.80.
    expect(table(plan.slice(5, 7))).toEqual([
      ['2026-07-05', 106.62, 99.45, 7.17, 617.89],
      ['2026-08-05', 104.79, 101.7, 3.09, 516.19],
    ])
    expect(table(plan.slice(-1))).toEqual([['2027-01-05', 104.8, 104.28, 0.52, 0]])
    expect(plan).toHaveLength(12)
  })

  it('keeps the instalment and ends sooner after an extra payment for a shorter term', () => {
    const loan = bankLoan()
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [extraPayment(loan, '2026-07-05', 300, 'shorter-term')])

    // 300.00 paid after instalment 6 leaves 617.89 − 300.00 = 317.89. At 106.62 a month it takes
    // instalments 7 to 9 (3.18, 2.14 and 1.10 interest) and leaves 4.45, which instalment 10 repays
    // with 0.04 interest, 4.49.
    expect(table(plan.slice(5, 8))).toEqual([
      ['2026-07-05', 106.62, 99.45, 7.17, 617.89],
      ['2026-07-05', 300, 300, 0, 317.89],
      ['2026-08-05', 106.62, 103.44, 3.18, 214.45],
    ])
    expect(plan[6]).toMatchObject({ kind: 'extra-payment', number: null })
    expect(table(plan.slice(-1))).toEqual([['2026-11-05', 4.49, 4.45, 0.04, 0]])
    expect(payoffDate(plan)).toBe('2026-11-05')
  })

  it('keeps the end and lowers the instalment after an extra payment for a lower instalment', () => {
    const loan = bankLoan()
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [extraPayment(loan, '2026-07-05', 300, 'lower-instalment')])

    // The annuity of 317.89 at 1% over the 6 instalments left is 54.85. Its last instalment repays
    // the 54.31 left with 0.54 interest, the same 54.85.
    expect(table(plan.slice(7, 8))).toEqual([['2026-08-05', 54.85, 51.67, 3.18, 266.22]])
    expect(table(plan.slice(-1))).toEqual([['2027-01-05', 54.85, 54.31, 0.54, 0]])
    expect(payoffDate(plan)).toBe('2027-01-05')
  })

  it('pays an extra payment between due dates before the next instalment, and stops at the balance', () => {
    const loan = bankLoan()
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [extraPayment(loan, '2026-02-20', 5000, 'shorter-term')])

    // Instalment 1 leaves 1,105.38, which the 5,000.00 more than covers, so the payment repays that and the plan ends.
    expect(table(plan)).toEqual([
      ['2026-02-05', 106.62, 94.62, 12, 1105.38],
      ['2026-02-20', 1105.38, 1105.38, 0, 0],
    ])
  })

  it('falls on the last day of a shorter month when the first instalment is on the 31st', () => {
    const loan = bankLoan({ firstInstalment: civil('2026-01-31'), instalments: 4 })
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-01-31', '12')], [])

    expect(plan.map((row) => row.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('splits a covered instalment into your share and a subsidy larger than its interest, leaving principal, interest and balance alone', () => {
    const loan = bankLoan({ subsidy: { monthly: euros(50), firstInstalment: 2, instalments: 3, payer: '' } })
    const plain = loanPlan(bankLoan(), [ratePeriod(loan, '2026-02-05', '12')], [])
    const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [])

    // Instalment 2 is 106.62 with 11.05 interest. The subsidy pays 50.00 of it and you 56.62.
    expect(plan[1]).toMatchObject({ number: 2, payment: euros(106.62), interest: euros(11.05), subsidy: euros(50), yourShare: euros(56.62) })
    expect(plan.map((row) => row.subsidy / 100)).toEqual([0, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(table(plan)).toEqual(table(plain))
  })
})

describe('the figures beside the plan', () => {
  const loan = bankLoan({
    drawdown: civil('2025-12-20'),
    interimInterest: { amount: euros(6), date: civil('2026-01-05') },
    subsidy: { monthly: euros(20), firstInstalment: 1, instalments: 12, payer: '' },
  })
  const plan = loanPlan(loan, [ratePeriod(loan, '2026-02-05', '12')], [])

  it('gives the balance on a day, counting a payment from its due date, and nothing before the drawdown', () => {
    expect(balanceOn(loan, plan, civil('2025-12-19'))).toBe(0)
    expect(balanceOn(loan, plan, civil('2026-02-04'))).toBe(euros(1200))
    expect(balanceOn(loan, plan, civil('2026-02-05'))).toBe(euros(1105.38))
    expect(balanceOn(loan, plan, civil('2027-06-01'))).toBe(0)
  })

  it('names the next payment after a day with the full instalment and your share, and the payoff date', () => {
    expect(nextPayment(plan, civil('2026-01-01'))).toMatchObject({ kind: 'interim-interest', date: '2026-01-05', payment: euros(6), yourShare: euros(6) })
    expect(nextPayment(plan, civil('2026-02-05'))).toMatchObject({ date: '2026-03-05', payment: euros(106.62), yourShare: euros(86.62) })
    expect(nextPayment(plan, civil('2027-01-05'))).toBeNull()
    expect(payoffDate(plan)).toBe('2027-01-05')
  })

  it('splits each year between principal and interest, the subsidy paying interest first, and what is left after a day', () => {
    // 2026: 6.00 interim interest, then instalments 1 to 11 with 78.36 interest (12.00, 11.05, 10.10,
    // 9.13, 8.16, 7.17, 6.18, 5.17, 4.16, 3.14 and 2.10) and 1,094.46 principal. The subsidy's 11 × 20.00
    // pays all 78.36 of that interest and 141.64 of the principal, which leaves you 952.82 principal
    // and the 6.00 interim interest. 2027 holds instalment 12: 1.06 interest and 105.54 principal, of
    // which the subsidy pays the interest and 18.94 principal.
    expect(paymentsByYear(plan)).toEqual([
      { year: 2026, instalments: 11, principal: euros(952.82), interest: euros(6), subsidyPrincipal: euros(141.64), subsidyInterest: euros(78.36), extra: 0 },
      { year: 2027, instalments: 1, principal: euros(86.6), interest: 0, subsidyPrincipal: euros(18.94), subsidyInterest: euros(1.06), extra: 0 },
    ])
    // After instalment 10 on 2026-11-05: instalments 11 and 12, 3.16 interest and 210.06 principal, 40.00 of them the subsidy's.
    const left = paymentsAfter(plan, civil('2026-11-05'))
    expect(left).toEqual({ principal: euros(173.22), interest: 0, subsidyPrincipal: euros(36.84), subsidyInterest: euros(3.16), extra: 0 })
    expect([paymentOf(left), principalOf(left), interestOf(left), subsidyShareOf(left), yourShareOf(left)]).toEqual([euros(213.22), euros(210.06), euros(3.16), euros(40), euros(173.22)])
    expect(yourPrincipalOf(left)).toBe(euros(173.22))
  })

  it('pays interest first out of a subsidy smaller than the interest, leaving the principal all yours', () => {
    // An instalment of 822.20, 423.66 principal and 398.54 interest, with a subsidy of 210.00.
    const row = {
      kind: 'instalment',
      date: civil('2026-11-20'),
      number: 44,
      payment: euros(822.2),
      principal: euros(423.66),
      interest: euros(398.54),
      subsidy: euros(210),
      yourShare: euros(612.2),
      balance: euros(0),
    } as const

    expect(splitOf(row)).toEqual({ principal: euros(423.66), interest: euros(188.54), subsidyPrincipal: 0, subsidyInterest: euros(210), extra: 0 })
  })

  it('counts an extra payment as principal you pay early', () => {
    const withExtra = loanPlan(bankLoan(), [ratePeriod(bankLoan(), '2026-02-05', '12')], [extraPayment(bankLoan(), '2026-04-20', 300, 'shorter-term')])
    const [year2026] = paymentsByYear(withExtra)

    expect(year2026?.extra).toBe(euros(300))
    // The 300.00 joins the principal the instalments leave you.
    expect(yourPrincipalOf(year2026!)).toBe(year2026!.principal + euros(300))
    expect(withExtra.find((row) => row.kind === 'extra-payment')).toMatchObject({ principal: euros(300) })
  })

  it('counts a late instalment as paid from the day it was paid, without changing the plan', () => {
    const late = lateInstalment(loan, '2026-03-05', '2026-03-23')

    // By 2026-03-10 the interim interest and instalment 1 count: 6.00 + 106.62 = 112.62, of which
    // you paid 6.00 + 86.62 = 92.62. Instalment 2 counts once it was paid on 2026-03-23.
    expect(paidSoFar(plan, [late], civil('2026-03-10'))).toEqual({ payment: euros(112.62), principal: euros(94.62), interest: euros(18), subsidy: euros(20), yourShare: euros(92.62) })
    expect(paidSoFar(plan, [], civil('2026-03-10')).payment).toBe(euros(219.24))
    expect(paidSoFar(plan, [late], civil('2026-03-23')).payment).toBe(euros(219.24))
    expect(balanceOn(loan, plan, civil('2026-03-10'))).toBe(euros(1009.81))
  })
})
