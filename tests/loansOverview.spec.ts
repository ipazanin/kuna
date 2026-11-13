import { describe, expect, it } from 'vitest'

import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { directionCaption, freeOfAllDebtOn, loansOverview, nextPaymentCaption } from '../src/apps/loans/overview/presentation/loansOverview'
import type { BankLoan } from '../src/apps/loans/workbook/domain/bankLoan'
import type { InformalLoan } from '../src/apps/loans/workbook/domain/informalLoan'
import { INFORMAL_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { Movement } from '../src/apps/loans/workbook/domain/movement'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, informalLoan, movement, ratePeriod } from './fixtures/loans'

function bankBook(loan: BankLoan) {
  const periods = [ratePeriod(loan, loan.firstInstalment, '12')]
  return { loan, ratePeriods: periods, extraPayments: [], lateInstalments: [], plan: loanPlan(loan, periods, []) }
}

function overviewOf(bank: BankLoan[], informal: { loan: InformalLoan; movements: Movement[] }[], day: string) {
  return loansOverview({ bankLoans: bank.map(bankBook), informalLoans: informal }, civil(day))
}

// Luka borrowed 500.00 from you on 1 Feb 2026 and paid it all back on 24 Jun.
const toLuka = informalLoan({
  id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-luka'),
  name: 'Small loans',
  counterparty: 'Luka',
  direction: 'owed-to-you',
  openingBalance: euros(0),
  start: civil('2026-02-01'),
})
const lukaSettled = { loan: toLuka, movements: [movement(toLuka, '2026-02-01', 'borrowed', 500), movement(toLuka, '2026-06-24', 'repaid', 500)] }

// Petra owed you 3,000.00 on 1 Jun 2026 and means to repay 500.00 on the 1st of each month from July.
// By 2 Nov she has repaid 1,500.00 of the 2,500.00 due, so she still owes 1,500.00.
const toPetra = informalLoan({
  id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-petra'),
  name: 'To Petra',
  counterparty: 'Petra',
  direction: 'owed-to-you',
  openingBalance: euros(3000),
  start: civil('2026-06-01'),
  expected: { monthly: euros(500), from: civil('2026-06-01'), day: 1 },
})
const petraBehind = { loan: toPetra, movements: [movement(toPetra, '2026-08-01', 'repaid', 1000), movement(toPetra, '2026-10-01', 'repaid', 500)] }

const fromAna = informalLoan({ start: civil('2026-01-02') })

describe('the loans of the Overview', () => {
  it('lists a settled loan owed to you under Completed with its direction, not under the open loans', () => {
    const overview = overviewOf([], [lukaSettled, petraBehind], '2026-11-02')

    expect(overview.openInformal.map((entry) => [entry.book.loan.name, entry.look.label])).toEqual([['To Petra', 'Owed to you']])
    expect(overview.completed.map((entry) => [entry.name, entry.look.label, entry.closed])).toEqual([['Small loans', 'Owed to you', 'Settled on 24 Jun 2026']])
  })

  it('keeps an informal loan open with its direction while what was repaid crosses zero', () => {
    // Repaying 3,150.00 of the 3,000.00 you owe Ana leaves her owing you 150.00, but the loan still runs your way.
    const overview = overviewOf([], [{ loan: fromAna, movements: [movement(fromAna, '2026-01-10', 'repaid', 3150)] }], '2026-02-01')

    expect(overview.openInformal.map((entry) => entry.look.label)).toEqual(['You owe'])
    expect(overview.totals.owedToYou).toBe(euros(150))
  })

  it('moves a bank loan to Completed on its payoff day and not before', () => {
    // Twelve instalments from 5 Feb 2026 end on 5 Jan 2027.
    expect(overviewOf([bankLoan()], [], '2027-01-04').openBank).toHaveLength(1)

    const paidOff = overviewOf([bankLoan()], [], '2027-01-05')
    expect(paidOff.openBank).toEqual([])
    expect(paidOff.completed.map((entry) => [entry.name, entry.look.label, entry.closed])).toEqual([['Car loan', 'You owe', 'Paid off on 5 Jan 2027']])
  })

  it('nets the two directions and says which way the net goes', () => {
    // Before their first instalment on 5 Nov the bank loans owe their whole principal, against the 1,500.00 Petra still owes.
    const drawnInOctober = { drawdown: civil('2026-10-05'), firstInstalment: civil('2026-11-05') }
    expect(overviewOf([bankLoan(drawnInOctober)], [petraBehind], '2026-11-02').net).toEqual({ amount: euros(300), direction: 'owed-to-you' })
    expect(overviewOf([bankLoan({ ...drawnInOctober, principal: euros(2000) })], [petraBehind], '2026-11-02').net).toEqual({ amount: euros(500), direction: 'you-owe' })

    // Luka owes you 150.00, and you owe Sara 300.00 until you repay her 150.00.
    const toLukaOpen = { loan: toLuka, movements: [movement(toLuka, '2026-02-01', 'borrowed', 150)] }
    const fromSara = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'from-sara'), name: 'From Sara', counterparty: 'Sara', openingBalance: euros(300), start: civil('2026-01-02') })
    expect(overviewOf([], [toLukaOpen, { loan: fromSara, movements: [] }], '2026-03-01').net).toEqual({ amount: euros(150), direction: 'you-owe' })
    expect(overviewOf([], [toLukaOpen, { loan: fromSara, movements: [movement(fromSara, '2026-02-10', 'repaid', 150)] }], '2026-03-01').net).toEqual({ amount: euros(0), direction: null })
  })

  it('names who is behind on a plan on the tile of the loan’s direction', () => {
    const overview = overviewOf([bankLoan()], [petraBehind, lukaSettled], '2026-11-02')

    expect(directionCaption(overview, 'owed-to-you')).toBe('on 1 loan, Petra is €1,000.00 behind')
    expect(directionCaption(overview, 'you-owe')).toBe('on 1 loan')
  })

  it('counts the loans behind when more than one is', () => {
    const toIvo = { ...petraBehind, loan: { ...toPetra, id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-ivo'), name: 'To Ivo', counterparty: 'Ivo' } }

    expect(directionCaption(overviewOf([], [petraBehind, toIvo], '2026-11-02'), 'owed-to-you')).toBe('on 2 loans, 2 loans behind on their plans')
    expect(directionCaption(overviewOf([], [petraBehind], '2026-11-02'), 'you-owe')).toBe('You owe nothing')
  })
})

describe('the next payment tile', () => {
  it('names the bank loan, or whom an informal plan repays and that it is overdue', () => {
    const fromDora = informalLoan({ name: 'From Dora', counterparty: 'Dora' })
    const amounts = { payment: euros(500), yourShare: euros(500) }

    expect(nextPaymentCaption({ kind: 'bank', loan: bankLoan({ name: 'Home loan' }), date: civil('2026-11-20'), ...amounts })).toBe('On 20 Nov, Home loan')
    expect(nextPaymentCaption({ kind: 'informal', loan: fromDora, date: civil('2026-12-01'), overdue: false, ...amounts })).toBe('On 1 Dec, repaying Dora')
    expect(nextPaymentCaption({ kind: 'informal', loan: fromDora, date: civil('2026-11-03'), overdue: true, ...amounts })).toBe('Overdue, repaying Dora')
    expect(nextPaymentCaption({ kind: 'informal', loan: { ...fromDora, counterparty: '' }, date: civil('2026-12-01'), overdue: false, ...amounts })).toBe('On 1 Dec, repaying From Dora')
  })
})

describe('the debt-free tile', () => {
  it('is free of all debt on the last bank payoff only while you owe nobody informally', () => {
    const lastPayoff = civil('2027-01-05')

    expect(freeOfAllDebtOn(overviewOf([bankLoan()], [petraBehind], '2026-11-02'), lastPayoff)).toBe(lastPayoff)
    expect(freeOfAllDebtOn(overviewOf([bankLoan()], [petraBehind, { loan: fromAna, movements: [] }], '2026-11-02'), lastPayoff)).toBeNull()
    // Ana is paid back in full, so the loan you owe her is settled and no longer keeps you in debt.
    expect(freeOfAllDebtOn(overviewOf([bankLoan()], [{ loan: fromAna, movements: [movement(fromAna, '2026-03-01', 'repaid', 3000)] }], '2026-11-02'), lastPayoff)).toBe(lastPayoff)
  })
})
