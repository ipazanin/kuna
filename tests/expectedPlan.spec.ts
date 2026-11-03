import { describe, expect, it } from 'vitest'

import { planPayments, planStanding } from '../src/apps/loans/informalLoans/domain/expectedPlan'
import { standingWords } from '../src/apps/loans/informalLoans/presentation/informalLoanView'
import type { ExpectedPlan } from '../src/apps/loans/workbook/domain/informalLoan'
import { civil, euros } from './fixtures/ledger'
import { informalLoan, movement } from './fixtures/loans'

// Petra owes 6,000.00 from 15 May 2026 and means to repay 500.00 on the 1st of each month from 1 Jun, so the first instalment falls due on 1 Jul.
const PLAN: ExpectedPlan = { monthly: euros(500), from: civil('2026-06-01'), day: 1 }
const toPetra = informalLoan({ name: 'To Petra', counterparty: 'Petra', direction: 'owed-to-you', openingBalance: euros(6000), start: civil('2026-05-15'), expected: PLAN })
const repaid = [movement(toPetra, '2026-07-03', 'repaid', 500), movement(toPetra, '2026-08-02', 'repaid', 500), movement(toPetra, '2026-10-05', 'repaid-in-kind', 500)]

describe("an informal loan's expected plan", () => {
  it('is €1,000.00 behind on 2 Nov 2026 after €1,500.00 repaid, with the next €500.00 due on 1 Dec 2026', () => {
    // Due on 1 Jul, 1 Aug, 1 Sep, 1 Oct and 1 Nov: 5 × 500.00 = 2,500.00 expected, less the 1,500.00 repaid.
    expect(planStanding(toPetra, repaid, civil('2026-11-02'))).toEqual({
      expected: euros(2500),
      repaid: euros(1500),
      ahead: euros(-1000),
      next: { date: civil('2026-12-01'), amount: euros(500) },
    })
    expect(standingWords(toPetra, planStanding(toPetra, repaid, civil('2026-11-02'))!)).toEqual({ text: 'Petra is €1,000.00 behind', tone: 'warning' })
  })

  it('counts an instalment as due only from the day after its due date', () => {
    // On 1 Nov the instalment of that day is not late yet: 4 × 500.00 = 2,000.00 expected.
    expect(planStanding(toPetra, repaid, civil('2026-11-01'))).toMatchObject({ expected: euros(2000), ahead: euros(-500), next: { date: civil('2026-11-01') } })
    expect(planStanding(toPetra, repaid, civil('2026-10-30'))).toMatchObject({ expected: euros(2000), ahead: euros(-500), next: { date: civil('2026-11-01') } })
  })

  it('puts a borrower who pays before the first due date ahead, and one who keeps up on track', () => {
    const early = [movement(toPetra, '2026-06-20', 'repaid', 600)]
    expect(planStanding(toPetra, early, civil('2026-06-25'))).toMatchObject({ expected: euros(0), ahead: euros(600), next: { date: civil('2026-07-01'), amount: euros(500) } })
    expect(standingWords(toPetra, planStanding(toPetra, early, civil('2026-06-25'))!)).toEqual({ text: 'Petra is €600.00 ahead', tone: 'success' })
    expect(standingWords(toPetra, planStanding(toPetra, repaid, civil('2026-09-01'))!)).toEqual({ text: 'On track', tone: null })
  })

  it('says you are behind on a loan you owe', () => {
    const fromAna = informalLoan({ openingBalance: euros(3000), expected: { monthly: euros(200), from: civil('2026-03-01'), day: 15 } })
    // Due on 15 Mar and 15 Apr by 20 Apr: 400.00 expected, 150.00 repaid.
    const standing = planStanding(fromAna, [movement(fromAna, '2026-04-10', 'repaid', 150)], civil('2026-04-20'))!
    expect(standing.ahead).toBe(euros(-250))
    expect(standingWords(fromAna, standing).text).toBe('You are €250.00 behind')
  })

  it('never counts repayments from before the plan starts, or what was borrowed or let go', () => {
    const movements = [movement(toPetra, '2026-05-20', 'repaid', 300), movement(toPetra, '2026-07-10', 'borrowed', 1000), movement(toPetra, '2026-07-11', 'forgiven', 100)]
    expect(planStanding(toPetra, movements, civil('2026-07-15'))).toMatchObject({ expected: euros(500), repaid: euros(0), ahead: euros(-500) })
  })

  it('asks for no more than is still owed, so the instalment runs short and the plan ends with the debt', () => {
    // 1,200.00 owed and nothing repaid: by 2 Oct four instalments ask 2,000.00, but only 1,200.00 can be asked, and nothing more falls due.
    const small = informalLoan({ direction: 'owed-to-you', counterparty: 'Ana', openingBalance: euros(1200), start: civil('2026-06-01'), expected: PLAN })
    expect(planStanding(small, [], civil('2026-10-02'))).toEqual({ expected: euros(1200), repaid: euros(0), ahead: euros(-1200), next: null })
    // By 2 Jul one instalment is due and 700.00 is left to fall due, 500.00 of it on 1 Aug.
    expect(planStanding(small, [], civil('2026-07-02'))?.next).toEqual({ date: civil('2026-08-01'), amount: euros(500) })
    // By 6 Aug two instalments ask 1,000.00, which was repaid, and the 200.00 still owed is the whole next instalment.
    expect(planStanding(small, [movement(small, '2026-08-05', 'repaid', 1000)], civil('2026-08-06'))?.next).toEqual({ date: civil('2026-09-01'), amount: euros(200) })
  })

  it('falls due on the last day of a month shorter than its day', () => {
    const monthEnd = informalLoan({ openingBalance: euros(3000), start: civil('2026-01-15'), expected: { monthly: euros(100), from: civil('2026-01-31'), day: 31 } })
    expect(planStanding(monthEnd, [], civil('2026-02-10'))?.next?.date).toBe(civil('2026-02-28'))
    // Due on 28 Feb and 31 Mar by 1 Apr.
    expect(planStanding(monthEnd, [], civil('2026-04-01'))?.expected).toBe(euros(200))
  })

  it('has no standing for a loan without a plan, and nothing next once the loan is settled', () => {
    expect(planStanding(informalLoan(), [], civil('2026-04-01'))).toBeNull()
    const settled = [movement(toPetra, '2026-07-03', 'repaid', 6000)]
    expect(planStanding(toPetra, settled, civil('2026-11-02'))).toEqual({ expected: euros(2500), repaid: euros(6000), ahead: euros(3500), next: null })
  })
})

describe('what an expected plan you owe still asks for', () => {
  // You borrowed 3,500.00 from Dora on 15 May 2026 and mean to repay 500.00 on the 1st of each month from 1 Jun.
  const fromDora = informalLoan({ name: 'From Dora', counterparty: 'Dora', openingBalance: euros(3500), start: civil('2026-05-15'), expected: PLAN })
  const repaidToDora = [movement(fromDora, '2026-07-03', 'repaid', 500), movement(fromDora, '2026-08-02', 'repaid', 500), movement(fromDora, '2026-10-05', 'repaid-in-kind', 500)]

  it('is what you are behind by, due now, then the instalments still to come up to what is still owed', () => {
    // On 2 Nov 2026 five instalments, 1 Jul to 1 Nov, asked 2,500.00 and 1,500.00 was repaid, so 1,000.00 is overdue.
    // 2,000.00 is still owed, so the 1,000.00 not yet due falls due as 500.00 on 1 Dec and 500.00 on 1 Jan, and nothing after.
    expect(planPayments(fromDora, repaidToDora, civil('2026-11-02'), 6)).toEqual([
      { date: civil('2026-11-02'), amount: euros(1000), overdue: true },
      { date: civil('2026-12-01'), amount: euros(500), overdue: false },
      { date: civil('2027-01-01'), amount: euros(500), overdue: false },
    ])
    expect(planStanding(fromDora, repaidToDora, civil('2026-11-02'))?.next).toEqual({ date: civil('2026-12-01'), amount: euros(500) })
  })

  it('has nothing overdue on a due date itself, and keeps to the count', () => {
    // On 1 Nov four instalments asked 2,000.00, so 500.00 is overdue and the 500.00 of 1 Nov is due that day.
    expect(planPayments(fromDora, repaidToDora, civil('2026-11-01'), 3)).toEqual([
      { date: civil('2026-11-01'), amount: euros(500), overdue: true },
      { date: civil('2026-11-01'), amount: euros(500), overdue: false },
      { date: civil('2026-12-01'), amount: euros(500), overdue: false },
    ])
    expect(planPayments(fromDora, repaidToDora, civil('2026-11-02'), 1)).toEqual([{ date: civil('2026-11-02'), amount: euros(1000), overdue: true }])
    expect(planPayments(fromDora, repaidToDora, civil('2026-11-02'), 0)).toEqual([])
  })

  it('asks for no more than is still owed when you are ahead, and the last instalment runs short', () => {
    // 3,000.00 repaid by 25 Jun, before the first due date: 500.00 is still owed and falls due on 1 Jul.
    const early = [movement(fromDora, '2026-06-20', 'repaid', 3000)]
    expect(planPayments(fromDora, early, civil('2026-06-25'), 6)).toEqual([{ date: civil('2026-07-01'), amount: euros(500), overdue: false }])
    // 3,200.00 repaid: the 300.00 still owed is the whole next instalment, on the card and in the list.
    const almost = [movement(fromDora, '2026-06-20', 'repaid', 3200)]
    expect(planPayments(fromDora, almost, civil('2026-06-25'), 6)).toEqual([{ date: civil('2026-07-01'), amount: euros(300), overdue: false }])
    expect(planStanding(fromDora, almost, civil('2026-06-25'))?.next).toEqual({ date: civil('2026-07-01'), amount: euros(300) })
  })

  it('asks for nothing without a plan, once settled, or once the other side owes', () => {
    expect(planPayments(informalLoan(), [], civil('2026-04-01'), 6)).toEqual([])
    expect(planPayments(fromDora, [movement(fromDora, '2026-07-03', 'repaid', 3500)], civil('2026-11-02'), 6)).toEqual([])
    expect(planPayments(fromDora, [movement(fromDora, '2026-07-03', 'repaid', 4000)], civil('2026-11-02'), 6)).toEqual([])
  })
})
