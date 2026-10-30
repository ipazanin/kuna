import { describe, expect, it, vi } from 'vitest'

import { nextPayment } from '../src/apps/loans/bankLoans/domain/loanFigures'
import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { debtFreeOn, estimateFrom, interestAfter, interestInYear, outgoingByMonth, owedByMonth, plannedLoans, upcomingPayments } from '../src/apps/loans/overview/domain/loansTogether'
import { loanBandToken, outgoingChart, owedTogetherChart } from '../src/apps/loans/overview/presentation/togetherCharts'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { ExtraPayment } from '../src/apps/loans/workbook/domain/extraPayment'
import { BANK_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { RatePeriod } from '../src/apps/loans/workbook/domain/ratePeriod'
import type { ChartTokens } from '../src/shared/charts/chartTokens'
import { parseMonthKey } from '../src/shared/calendar/monthKey'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { OTHER_UUID, bankLoan, extraPayment, ratePeriod } from './fixtures/loans'

/**
 * A house loan of 2,400.00 over 24 instalments from 2026-02-05 at 12%, so 1% a month, with a subsidy
 * of 50.00 on its first 12 instalments. Its annuity is 112.98, and the last instalment takes the
 * 112.89 left. Beside it a car loan of 600.00 over 6 instalments of 100.00 from 2026-02-20 at 0%,
 * which ends on 2026-07-20, long before the house loan.
 */
const HOUSE = bankLoan({
  name: 'House loan',
  principal: euros(2400),
  drawdown: civil('2026-01-05'),
  firstInstalment: civil('2026-02-05'),
  instalments: 24,
  subsidy: { monthly: euros(50), firstInstalment: 1, instalments: 12, payer: 'APN' },
})
const CAR = bankLoan({ id: recordIdOf(BANK_LOAN_RECORDS, OTHER_UUID), principal: euros(600), drawdown: civil('2026-01-20'), firstInstalment: civil('2026-02-20'), instalments: 6 })

function book(loan: BankLoan, periods: readonly RatePeriod[], extraPayments: readonly ExtraPayment[] = []) {
  return { loan, ratePeriods: periods, extraPayments, lateInstalments: [], plan: loanPlan(loan, periods, extraPayments) }
}

const LOANS = plannedLoans([book(HOUSE, [ratePeriod(HOUSE, '2026-02-05', '12')]), book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')])])
// The car loan's instalments of 20 Feb paid, and the house loan's of 5 Feb and 5 Mar.
const DAY = civil('2026-03-10')

function month(text: string): MonthKey {
  return parseMonthKey(text)!
}

describe('what the loans owe together over time', () => {
  const months = owedByMonth(LOANS)

  it('runs from the earliest drawdown to the last payoff, a month end at a time', () => {
    expect(months[0]?.month).toBe('2026-01')
    expect(months.at(-1)?.month).toBe('2028-01')
    expect(months).toHaveLength(25)
  })

  it('gives each loan its balance at the month end and adds them up', () => {
    // Nothing is repaid in January, so the whole 2,400.00 and 600.00 are owed.
    expect(months[0]).toEqual({ month: '2026-01', amounts: [euros(2400), euros(600)], total: euros(3000) })
    // The house loan's first instalment repays 112.98 − 24.00 interest = 88.98 of principal, and the car loan's 100.00.
    expect(months[1]).toEqual({ month: '2026-02', amounts: [euros(2311.02), euros(500)], total: euros(2811.02) })
    // The car loan is paid off with its sixth instalment in July and owes nothing after.
    expect(months[6]).toEqual({ month: '2026-07', amounts: [euros(1852.59), euros(0)], total: euros(1852.59) })
    expect(months.at(-1)?.total).toBe(euros(0))
  })

  it('counts a loan only from its drawdown', () => {
    const later = bankLoan({ id: recordIdOf(BANK_LOAN_RECORDS, 'later'), drawdown: civil('2026-03-01'), firstInstalment: civil('2026-04-01'), instalments: 2 })
    const both = owedByMonth(plannedLoans([book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')]), book(later, [ratePeriod(later, '2026-04-01', '0', 'later')])]))

    expect(both.map((entry) => entry.amounts[1])).toEqual([0, 0, 1200, 600, 0, 0, 0].map(euros))
  })
})

describe('what goes out each month over the loans', () => {
  const months = outgoingByMonth(LOANS)

  it('adds your share of each loan, so the car loan ending shows as a drop and the subsidy ending as a rise', () => {
    const totals = new Map(months.map((entry) => [entry.month, entry.total]))

    expect(months[0]?.month).toBe('2026-02')
    // February to July: 112.98 − 50.00 subsidy = 62.98 on the house loan and 100.00 on the car loan.
    expect(totals.get(month('2026-07'))).toBe(euros(162.98))
    // From August only the house loan is left.
    expect(totals.get(month('2026-08'))).toBe(euros(62.98))
    // From February 2027 the subsidy has ended, so the whole 112.98 is yours, and the last instalment is 112.89.
    expect(totals.get(month('2027-02'))).toBe(euros(112.98))
    expect(months.at(-1)).toEqual({ month: '2028-01', amounts: [euros(112.89), euros(0)], total: euros(112.89) })
  })

  it('leaves out an extra payment, which still lowers what is owed', () => {
    const withExtra = plannedLoans([book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')], [extraPayment(CAR, '2026-03-01', 200, 'lower-instalment')])])

    // 500.00 owed after February, less 200.00, over 5 instalments left: 60.00 each.
    expect(outgoingByMonth(withExtra).map((entry) => entry.total)).toEqual([100, 60, 60, 60, 60, 60].map(euros))
    expect(owedByMonth(withExtra)[2]?.total).toBe(euros(240))
  })
})

describe('the payments coming up over the loans', () => {
  it('lists every scheduled payment after the day by due date, with the full payment and your share', () => {
    const upcoming = upcomingPayments(LOANS, DAY)

    expect(upcoming.slice(0, 3).map(({ loan, date, payment, yourShare }) => [loan.name, date, payment, yourShare])).toEqual([
      ['Car loan', '2026-03-20', euros(100), euros(100)],
      ['House loan', '2026-04-05', euros(112.98), euros(62.98)],
      ['Car loan', '2026-04-20', euros(100), euros(100)],
    ])
    // 22 house loan instalments and 5 car loan instalments are still to come.
    expect(upcoming).toHaveLength(27)
  })

  it('counts a payment due on the day as paid, as the loan card does', () => {
    const onDueDate = civil('2026-04-05')

    expect(
      upcomingPayments(LOANS, onDueDate)
        .slice(0, 2)
        .map(({ loan, date }) => [loan.name, date]),
    ).toEqual([
      ['Car loan', '2026-04-20'],
      ['House loan', '2026-05-05'],
    ])
    expect(nextPayment(LOANS[0]!.plan, onDueDate)?.date).toBe('2026-05-05')
  })

  it('puts two payments due on one day in the order of the loans', () => {
    const sameDay = bankLoan({ id: recordIdOf(BANK_LOAN_RECORDS, 'same-day'), name: 'Boat loan', firstInstalment: civil('2026-02-20'), instalments: 2 })
    const loans = plannedLoans([book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')]), book(sameDay, [ratePeriod(sameDay, '2026-02-20', '0', 'boat')])])

    expect(
      upcomingPayments(loans, civil('2026-02-01'))
        .slice(0, 2)
        .map((payment) => payment.loan.name),
    ).toEqual(['Car loan', 'Boat loan'])
  })

  it('leaves out a loan whose plan cannot be worked out', () => {
    expect(plannedLoans([{ ...book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')]), plan: null }])).toEqual([])
  })
})

describe('the interest over the loans', () => {
  it("adds the interest of the year's instalments and what the subsidy pays of it", () => {
    // 24.00 + 23.11 + 22.21 + 21.30 + 20.39 + 19.46 + 18.53 + 17.58 + 16.63 + 15.66 + 14.69 from February to December.
    // The subsidy's 50.00 is above each month's interest, so it pays all of it. The car loan carries none.
    expect(interestInYear(LOANS, 2026)).toEqual({ interest: euros(213.56), subsidy: euros(213.56) })
  })

  it('adds the interest still to pay after the day and the part the subsidy pays', () => {
    // 23 × 112.98 + 112.89 − 2,400.00 = 311.43 over the loan, less 24.00 and 23.11 already paid.
    // The subsidy pays the interest of instalments 3 to 12, from 22.21 in April down to 13.71 in January 2027.
    expect(interestAfter(LOANS, DAY)).toEqual({ interest: euros(264.32), subsidy: euros(180.16) })
  })

  it("leaves out the interest of an instalment due on the day, as the loan card's still to pay does", () => {
    // The 22.21 of the April instalment, which the subsidy pays, is paid on its due date.
    expect(interestAfter(LOANS, civil('2026-04-05'))).toEqual({ interest: euros(242.11), subsidy: euros(157.95) })
  })
})

describe('the day you are free of the loans', () => {
  it('is the last payoff over the loans', () => {
    expect(debtFreeOn(LOANS)).toBe('2028-01-05')
    expect(debtFreeOn([])).toBeNull()
  })

  it('has no day while a bank loan has no plan, since its end is not known', () => {
    const unplanned = { ...book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')]), plan: null }

    expect(debtFreeOn([...LOANS, unplanned])).toBeNull()
  })

  it('names the first month worked out at a variable rate as where the estimates start', () => {
    const variable: RatePeriod = { ...ratePeriod(HOUSE, '2027-02-05', '9', 'variable'), rateType: 'variable' }
    const loans = plannedLoans([book(HOUSE, [ratePeriod(HOUSE, '2026-02-05', '12'), variable]), book(CAR, [ratePeriod(CAR, '2026-02-20', '0', 'car')])])

    expect(estimateFrom(loans, DAY)).toBe('2027-02')
    expect(estimateFrom(LOANS, DAY)).toBeNull()
    // Once the variable rate has started, the estimates start with the first instalment after the day.
    expect(estimateFrom(loans, civil('2027-03-10'))).toBe('2027-04')
    expect(estimateFrom(loans, civil('2027-02-05'))).toBe('2027-03')
  })
})

const TOKENS = new Proxy({}, { get: (_target, name) => String(name) }) as unknown as ChartTokens

// The charts read their loan colours from the page, which a spec has none of, so each token reads as its own name.
vi.stubGlobal('document', { documentElement: {} })
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (token: string) => token }))

interface DrawnSeries {
  name: string
  color: string
  stack?: string
  step?: string
  data: unknown[]
}

function seriesOf(chart: { option: unknown }): DrawnSeries[] {
  return (chart.option as { series: DrawnSeries[] }).series
}

describe('the charts over the loans', () => {
  const current = month('2026-03')

  it('stacks each loan in its band colour and traces the total in brass from the current month', () => {
    const chart = owedTogetherChart(LOANS, owedByMonth(LOANS), current, debtFreeOn(LOANS), TOKENS, false, null)
    const [house, car, ahead] = seriesOf(chart)

    expect([house?.name, car?.name, ahead?.name]).toEqual(['House loan', 'Car loan', ''])
    expect([house?.color, car?.color, ahead?.color]).toEqual(['--loan-band-1', '--loan-band-2', '--loan-ahead'])
    expect([house?.stack, car?.stack]).toEqual(['owed', 'owed'])
    expect(ahead?.data.slice(0, 3)).toEqual([null, null, euros(2621.15)])
    expect(chart.description).toBe(
      'What House loan and Car loan owe at each month end from Jan 2026 to Jan 2028, stacked by loan. At the end of Mar 2026 it is €2,621.15 in all. By the plans you are free of all debt in Jan 2028.',
    )
  })

  it('draws what goes out as steps, and says when the car loan ends and what goes out after', () => {
    const chart = outgoingChart(LOANS, outgoingByMonth(LOANS), current, TOKENS, false, null)
    const [house, , ahead] = seriesOf(chart)

    expect(house?.step).toBe('end')
    expect(ahead?.data.slice(0, 2)).toEqual([null, 0])
    expect(chart.description).toBe(
      'Your share of the instalments of House loan and Car loan in each month from Feb 2026 to Jan 2028, stacked by loan. In Mar 2026 it is €162.98. Car loan ends in Jul 2026, and the month after €62.98 goes out.',
    )
  })

  it('has no brass once every loan is paid off', () => {
    const chart = outgoingChart(LOANS, outgoingByMonth(LOANS), month('2028-01'), TOKENS, false, null)

    expect(chart.hasAhead).toBe(false)
    expect(seriesOf(chart).map((series) => series.name)).toEqual(['House loan', 'Car loan'])
  })

  it('gives a fourth loan and later the muted colour', () => {
    expect([0, 1, 2, 3, 4].map(loanBandToken)).toEqual(['--loan-band-1', '--loan-band-2', '--loan-band-3', '--chart-deemphasis', '--chart-deemphasis'])
  })
})
