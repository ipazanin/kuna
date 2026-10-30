import { describe, expect, it } from 'vitest'

import { balanceOn, interestOf, splitOfRows } from '../src/apps/loans/bankLoans/domain/loanFigures'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { LoanChange, LoanCosts, OfferTerms } from '../src/apps/loans/scenarios/domain/loanScenario'
import { moveBreakEven, scenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome'
import { offerBase, scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import type { ScenarioBase, ScenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { RatePeriod } from '../src/apps/loans/workbook/domain/ratePeriod'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, percent, ratePeriod } from './fixtures/loans'

function baseOf(loan: BankLoan, periods: readonly RatePeriod[]): ScenarioBase {
  return { loan, ratePeriods: periods, extraPayments: [], costs: NO_COSTS }
}

function worked(base: ScenarioBase, changes: readonly LoanChange[], today: CivilDate | null = null): ScenarioPlan {
  const plan = scenarioPlan(base, changes, today)
  if ('refused' in plan) throw new Error(`The scenario is refused: ${plan.refused}`)
  return plan
}

function costs(upfront: number, monthly: number, yearly: number): LoanCosts {
  return { upfront: euros(upfront), monthly: euros(monthly), yearly: euros(yearly) }
}

const instalmentsOf = (plan: ScenarioPlan) => plan.rows.filter((row) => row.kind === 'instalment')

describe('an extra payment in a scenario', () => {
  // 100,000.00 over 240 instalments at 3.5%, and 10,000.00 extra on the drawdown, before the first instalment.
  const loan = bankLoan({ principal: euros(100_000), instalments: 240 })
  const base = baseOf(loan, [ratePeriod(loan, '2026-02-05', '3.5')])
  const stands = scenarioOutcome(worked(base, []), null)

  it.each([
    ['shorter-term', 579.96, 207, 9_191.13],
    ['lower-instalment', 521.96, 240, 3_918.56],
  ] as const)('with a %s pays %s for %s instalments and saves %s of interest', (effect, instalment, count, saved) => {
    const outcome = scenarioOutcome(worked(base, [{ kind: 'extra-payment', date: civil('2026-01-05'), amount: euros(10_000), effect }]), null)

    expect(outcome.nextInstalment).toBe(euros(instalment))
    expect(outcome.instalments).toBe(count)
    expect(stands.interest - outcome.interest).toBe(euros(saved))
    expect(outcome.extra).toBe(euros(10_000))
  })
})

describe('a rate change in a scenario', () => {
  // 100,000.00 over 300 instalments at 6-month EURIBOR 2.50% plus a 1.20 margin, 3.70%, reset a year later.
  const loan = bankLoan({ principal: euros(100_000), instalments: 300 })
  const base = baseOf(loan, [{ ...ratePeriod(loan, '2026-02-05', '3.7'), rateType: 'variable' }])

  it.each([
    ['5.7', 622.15],
    ['3.84', 518.79],
  ])('recomputes the instalment at %s%% from the reset a year later, to %s', (rate, instalment) => {
    const plan = worked(base, [{ kind: 'rate-change', from: civil('2027-02-05'), rate: percent(rate), rateType: 'variable' }])

    expect(instalmentsOf(plan)[0]!.payment).toBe(euros(511.41))
    expect(instalmentsOf(plan)[12]).toMatchObject({ date: '2027-02-05', payment: euros(instalment) })
    expect(instalmentsOf(plan)).toHaveLength(300)
  })

  it('replaces a rate period of the loan that starts on the same due date', () => {
    const later = baseOf(loan, [ratePeriod(loan, '2026-02-05', '3.7'), ratePeriod(loan, '2027-02-05', '5.7')])
    const plan = worked(later, [{ kind: 'rate-change', from: civil('2027-02-05'), rate: percent('3.84'), rateType: 'fixed' }])

    expect(instalmentsOf(plan)[12]!.payment).toBe(euros(518.79))
    expect(plan.periods.map((period) => [period.from, period.rate])).toEqual([
      ['2026-02-05', percent('3.7')],
      ['2027-02-05', percent('3.84')],
    ])
  })

  it('refuses a rate change that does not start on a due date, or two on the same one', () => {
    const change = { kind: 'rate-change', from: civil('2027-02-06'), rate: percent('4'), rateType: 'fixed' } as const

    expect(scenarioPlan(base, [change], null)).toEqual({ refused: 'not-a-due-date', date: '2027-02-06', loan: 'Car loan' })
    expect(
      scenarioPlan(
        base,
        [
          { ...change, from: civil('2027-02-05') },
          { ...change, from: civil('2027-02-05') },
        ],
        null,
      ),
    ).toEqual({ refused: 'rate-shares-day', date: '2027-02-05' })
  })
})

describe('a regular extra payment', () => {
  // 1,200.00 over 12 instalments at 12% from 2026-02-05.
  const loan = bankLoan()
  const base = baseOf(loan, [ratePeriod(loan, '2026-02-05', '12')])
  const extrasOf = (plan: ScenarioPlan) => plan.rows.filter((row) => row.kind === 'extra-payment').map((row) => [row.date, row.payment / 100])

  it('pays on each due date from the first, every month up to the last day it may fall on, after that day’s instalment', () => {
    const plan = worked(base, [{ kind: 'regular-extra-payment', from: civil('2026-04-05'), every: 'month', until: civil('2026-06-05'), amount: euros(100), effect: 'shorter-term' }])

    expect(extrasOf(plan)).toEqual([
      ['2026-04-05', 100],
      ['2026-05-05', 100],
      ['2026-06-05', 100],
    ])
    expect(plan.rows.findIndex((row) => row.date === '2026-04-05' && row.kind === 'extra-payment')).toBe(plan.rows.findIndex((row) => row.date === '2026-04-05') + 1)
    expect(plan.firstEarlyRepayment).toBe('2026-04-05')
  })

  it('pays every 12th due date to the end when it has no last day, and stops once the loan is repaid', () => {
    const longer = bankLoan({ instalments: 24 })
    const yearly = worked(baseOf(longer, [ratePeriod(longer, '2026-02-05', '12')]), [
      { kind: 'regular-extra-payment', from: civil('2026-03-05'), every: 'year', until: null, amount: euros(100), effect: 'lower-instalment' },
    ])
    const monthly = worked(base, [{ kind: 'regular-extra-payment', from: civil('2026-02-05'), every: 'month', until: null, amount: euros(400), effect: 'shorter-term' }])

    expect(extrasOf(yearly)).toEqual([
      ['2026-03-05', 100],
      ['2027-03-05', 100],
    ])
    // The payments after the balance is repaid are dropped.
    expect(monthly.rows.at(-1)!.balance).toBe(0)
    expect(extrasOf(monthly).length).toBeLessThan(12)
  })
})

describe('changes dated on or before today', () => {
  const loan = bankLoan()
  const base = baseOf(loan, [ratePeriod(loan, '2026-02-05', '12')])
  const today = civil('2026-06-10')
  const stands = worked(base, [])

  it('count from the first due date after today, marked as passed, so what is owed today stays as it was', () => {
    const extra = { kind: 'extra-payment', date: civil('2026-04-01'), amount: euros(300), effect: 'shorter-term' } as const
    const rate = { kind: 'rate-change', from: civil('2026-03-05'), rate: percent('6'), rateType: 'fixed' } as const
    const plan = worked(base, [extra, rate], today)

    expect(plan.passed).toEqual([extra, rate])
    expect(plan.rows.find((row) => row.kind === 'extra-payment')!.date).toBe('2026-07-05')
    expect(plan.periods.map((period) => period.from)).toEqual(['2026-02-05', '2026-07-05'])
    expect(balanceOn(loan, plan.rows, today)).toBe(balanceOn(loan, stands.rows, today))
    expect(plan.rows.filter((row) => row.date <= today)).toEqual(stands.rows.filter((row) => row.date <= today))
  })

  it('drop a regular payment’s days by today and keep the rest', () => {
    const regular = { kind: 'regular-extra-payment', from: civil('2026-04-05'), every: 'month', until: civil('2026-08-05'), amount: euros(50), effect: 'lower-instalment' } as const
    const plan = worked(base, [regular], today)

    expect(plan.passed).toEqual([regular])
    expect(plan.rows.filter((row) => row.kind === 'extra-payment').map((row) => row.date)).toEqual(['2026-07-05', '2026-08-05'])
  })

  it('count a change dated on today as passed, and drop a regular payment’s day on today', () => {
    const onToday = civil('2026-06-05')
    const extra = { kind: 'extra-payment', date: onToday, amount: euros(300), effect: 'shorter-term' } as const
    const regular = { kind: 'regular-extra-payment', from: civil('2026-04-05'), every: 'month', until: civil('2026-08-05'), amount: euros(50), effect: 'shorter-term' } as const
    const plan = worked(base, [extra, regular], onToday)

    expect(plan.passed).toEqual([extra, regular])
    expect(plan.rows.filter((row) => row.kind === 'extra-payment').map((row) => [row.date, row.payment / 100])).toEqual([
      ['2026-07-05', 300],
      ['2026-07-05', 50],
      ['2026-08-05', 50],
    ])
  })

  it('keep only the latest of the rate changes by today, from the first due date after it', () => {
    const path = [
      { kind: 'rate-change', from: civil('2026-03-05'), rate: percent('5'), rateType: 'fixed' },
      { kind: 'rate-change', from: civil('2026-06-05'), rate: percent('6'), rateType: 'fixed' },
    ] as const
    const plan = worked(base, path, today)

    expect(plan.passed).toEqual(path)
    expect(plan.periods.map((period) => [period.from, period.rate])).toEqual([
      ['2026-02-05', percent('12')],
      ['2026-07-05', percent('6')],
    ])
  })

  it('give way to a rate change dated on the first due date after today', () => {
    const passedRate = { kind: 'rate-change', from: civil('2026-03-05'), rate: percent('5'), rateType: 'fixed' } as const
    const plan = worked(base, [passedRate, { ...passedRate, from: civil('2026-07-05'), rate: percent('7') }], today)

    expect(plan.passed).toEqual([passedRate])
    expect(plan.periods.map((period) => [period.from, period.rate])).toEqual([
      ['2026-02-05', percent('12')],
      ['2026-07-05', percent('7')],
    ])
  })

  it('leave a change after today as it is', () => {
    expect(worked(base, [{ kind: 'extra-payment', date: civil('2026-06-11'), amount: euros(100), effect: 'shorter-term' }], today).passed).toEqual([])
  })
})

describe('a move to another bank', () => {
  // A loan whose first instalment is interest free, so 120,000.00 is left after it, with 216 instalments to go at 4.2%.
  // 120,555.56 / 217 = 555.56, and 120,555.56 − 555.56 = 120,000.00.
  const loan = bankLoan({ principal: euros(120_555.56), instalments: 217 })
  const base = baseOf(loan, [ratePeriod(loan, '2026-02-05', '0'), ratePeriod(loan, '2026-03-05', '4.2')])
  const move = { kind: 'move', on: civil('2026-02-05'), lender: 'Other Bank', rate: percent('3.4'), rateType: 'fixed', instalments: 216, costs: costs(1500, 0, 0) } as const
  const withoutMove = worked(base, [])
  const withMove = worked(base, [move])
  const dayBefore = civil('2026-02-04')

  it('keeps the old loan up to the move, then a new loan for what is still owed, a month later, at its own rate', () => {
    const [old, ...moved] = instalmentsOf(withMove)

    expect(old).toMatchObject({ date: '2026-02-05', number: 1, balance: euros(120_000) })
    expect(moved).toHaveLength(216)
    expect(moved[0]).toMatchObject({ date: '2026-03-05', number: 1, payment: euros(743.55) })
    expect(instalmentsOf(withoutMove)[1]!.payment).toBe(euros(792.69))
    expect(withMove.rows.some((row) => row.kind === 'extra-payment')).toBe(false)
    expect(withMove.move).toBe('2026-02-05')
  })

  it('saves 49.14 a month, pays its 1,500.00 of costs back in month 31 and cuts the interest left from 51,222.18 to 40,607.01', () => {
    const before = scenarioOutcome(withoutMove, civil('2026-02-05'))
    const after = scenarioOutcome(withMove, civil('2026-02-05'))

    expect(after.afterMove).toBe(euros(743.55))
    expect(before.interest).toBe(euros(51_222.18))
    expect(after.interest).toBe(euros(40_607.01))
    // 1,500.00 / 49.14 = 30.5, so the 31st new instalment, on 2028-09-05, is the first month end the costs are back.
    expect(moveBreakEven(withMove, withoutMove)).toEqual({ month: '2028-09', months: 31 })
    // Both repay the same principal, so you pay 1,500.00 + 40,607.01 − 51,222.18 = −9,115.17 more with the move.
    expect(scenarioOutcome(withMove, dayBefore).costs).toBe(euros(1500))
    expect(scenarioOutcome(withMove, dayBefore).total - scenarioOutcome(withoutMove, dayBefore).total).toBe(euros(-9115.17))
  })

  it('charges the new loan’s monthly cost with each of its instalments and its yearly cost once per started year', () => {
    const charged = worked(base, [{ ...move, costs: costs(0, 2, 30) }])

    expect(charged.costs.filter((cost) => cost.amount === euros(2))).toHaveLength(216)
    expect(charged.costs.filter((cost) => cost.amount === euros(30)).map((cost) => cost.date)).toEqual(Array.from({ length: 18 }, (_, year) => `${2026 + year}-02-05`))
  })

  it('gives a cost-free move at the same rate its break-even in the move’s own month', () => {
    const sameRate = worked(base, [{ ...move, rate: percent('4.2'), costs: NO_COSTS }])

    expect(moveBreakEven(sameRate, withoutMove)).toEqual({ month: '2026-02', months: 0 })
  })

  it.each([
    ['2026-02-28', ['2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31']],
    ['2026-03-31', ['2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31']],
  ])('keeps a loan due on the 31st on month ends after a move on %s, so a rate change on 31 Jul is a due date of the new loan', (on, dues) => {
    const monthEnd = bankLoan({ firstInstalment: civil('2026-01-31'), instalments: 24 })
    const plan = worked(baseOf(monthEnd, [ratePeriod(monthEnd, '2026-01-31', '12')]), [
      { ...move, on: civil(on), instalments: 12, costs: costs(0, 1, 0) },
      { kind: 'rate-change', from: civil('2026-07-31'), rate: percent('5'), rateType: 'fixed' },
    ])
    const moved = instalmentsOf(plan).filter((row) => row.date > on)

    expect(moved.slice(0, 5).map((row) => row.date)).toEqual(dues)
    expect(plan.costs.slice(0, 5).map((cost) => cost.date)).toEqual(dues)
    expect(plan.periods.map((period) => period.from)).toEqual(['2026-01-31', dues[0], '2026-07-31'])
  })

  it('refuses a move off a due date, after the payoff, or a second move', () => {
    expect(scenarioPlan(base, [{ ...move, on: civil('2026-02-06') }], null)).toEqual({ refused: 'not-a-due-date', date: '2026-02-06', loan: 'Car loan' })
    expect(scenarioPlan(base, [{ ...move, on: civil('2044-02-05') }], null)).toEqual({ refused: 'move-not-before-payoff', on: '2044-02-05' })
    expect(scenarioPlan(base, [move, { ...move, on: civil('2027-02-05') }], null)).toEqual({ refused: 'two-moves' })
  })

  it('applies the rate changes after the move to the new loan, on its own due dates', () => {
    const plan = worked(base, [move, { kind: 'rate-change', from: civil('2027-03-05'), rate: percent('5'), rateType: 'variable' }])
    const outcome = scenarioOutcome(plan, civil('2026-02-05'))

    expect(outcome.variableFrom).toBe('2027-03-05')
    expect(outcome.highestInstalment?.estimate).toBe(true)
  })
})

describe('an offer', () => {
  const terms: OfferTerms = {
    lender: 'Example Bank',
    principal: euros(1200),
    drawdown: civil('2026-01-05'),
    firstInstalment: civil('2026-02-05'),
    instalments: 12,
    interimInterest: { amount: euros(3.5), date: civil('2026-01-20') },
    subsidy: null,
    costs: costs(10, 1, 5),
    bankEks: null,
  }
  const rate = { kind: 'rate-change', from: civil('2026-02-05'), rate: percent('12'), rateType: 'fixed' } as const

  it('takes its rate from its rate changes, and is refused without one at its first instalment', () => {
    expect(instalmentsOf(worked(offerBase('Offer', terms), [rate]))[0]!.payment).toBe(euros(106.62))
    expect(scenarioPlan(offerBase('Offer', terms), [], null)).toEqual({ refused: 'no-first-rate', firstInstalment: '2026-02-05' })
  })

  it('pays its costs on their dates: one-off on the drawdown, monthly with the interim interest and each instalment, yearly per started year', () => {
    const plan = worked(offerBase('Offer', terms), [rate])
    const outcome = scenarioOutcome(plan, null)

    expect(plan.costs.filter((cost) => cost.amount === euros(10)).map((cost) => cost.date)).toEqual(['2026-01-05'])
    expect(plan.costs.filter((cost) => cost.amount === euros(1)).map((cost) => cost.date)).toEqual(['2026-01-20', ...instalmentsOf(plan).map((row) => row.date)])
    expect(plan.costs.filter((cost) => cost.amount === euros(5)).map((cost) => cost.date)).toEqual(['2026-01-05'])
    // 10.00 + 13 × 1.00 + 5.00 = 28.00.
    expect(outcome.costs).toBe(euros(28))
    expect(outcome.total).toBe(euros(1200) + outcome.interest + euros(28))
  })

  it('charges its yearly cost at the start of each started year, three times over 30 instalments', () => {
    const plan = worked(offerBase('Offer', { ...terms, instalments: 30 }), [rate])

    expect(plan.costs.filter((cost) => cost.amount === euros(5)).map((cost) => cost.date)).toEqual(['2026-01-05', '2027-01-05', '2028-01-05'])
  })
})

describe('the highest instalment', () => {
  // 10,000.00 over 12 instalments at a fixed 5%: 856.07 a month, and the last takes the rounding left over, 856.12.
  const loan = bankLoan({ principal: euros(10_000) })
  const plan = worked(baseOf(loan, [ratePeriod(loan, '2026-02-05', '5')]), [])

  it('leaves out the last instalment’s rounding, so a fixed loan’s highest is its regular instalment', () => {
    const outcome = scenarioOutcome(plan, null)

    expect(instalmentsOf(plan).at(-1)!.payment).toBe(euros(856.12))
    expect(outcome.highestInstalment?.amount).toBe(euros(856.07))
    expect(outcome.highestInstalment?.amount).toBe(outcome.nextInstalment)
  })

  it('counts the last instalment when it is the only one left', () => {
    expect(scenarioOutcome(plan, civil('2026-12-05')).highestInstalment?.amount).toBe(euros(856.12))
  })
})

describe('the subsidy in a scenario', () => {
  // A subsidy of 10.00 on the first 12 of 60 instalments, the last on 2027-01-05, so repaying early by 2029-01-05 means paying it back.
  const loan = bankLoan({ instalments: 60, subsidy: { monthly: euros(10), firstInstalment: 1, instalments: 12, payer: 'APN' } })
  const base = baseOf(loan, [ratePeriod(loan, '2026-02-05', '12')])

  it('names the last day of the payback rule and what the subsidy paid by the change, for an early repayment inside it', () => {
    const plan = worked(base, [{ kind: 'extra-payment', date: civil('2026-06-20'), amount: euros(100), effect: 'shorter-term' }])

    // Instalments 1 to 5 fall due by 2026-06-20, so the subsidy has paid 5 × 10.00.
    expect(scenarioOutcome(plan, null).subsidyPayback).toEqual({ until: '2029-01-05', paidByChange: euros(50) })
    expect(scenarioOutcome(worked(base, [{ kind: 'extra-payment', date: civil('2029-01-06'), amount: euros(100), effect: 'shorter-term' }]), null).subsidyPayback).toBeNull()
    expect(scenarioOutcome(worked(base, [{ kind: 'rate-change', from: civil('2026-06-05'), rate: percent('10'), rateType: 'fixed' }]), null).subsidyPayback).toBeNull()
  })

  it('keeps what the subsidy pays out of what you pay', () => {
    const plan = worked(base, [])
    const outcome = scenarioOutcome(plan, null)

    expect(outcome.subsidy).toBe(euros(120))
    expect(outcome.total + outcome.subsidy).toBe(euros(1200) + interestOf(splitOfRows(plan.rows)))
  })
})
