import { describe, expect, it } from 'vitest'

import { triedRate, whatIfChange } from '../src/apps/loans/bankLoans/domain/whatIf'
import { savedTries } from '../src/apps/loans/bankLoans/presentation/savedTries'
import { words } from '../src/apps/loans/bankLoans/presentation/words'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import { scenarioOutcome } from '../src/apps/loans/scenarios/domain/scenarioOutcome'
import { scenarioPlan } from '../src/apps/loans/scenarios/domain/scenarioPlan'
import { BANK_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { fakeLoansDocument } from '../src/apps/loans/workbook/infrastructure/fake/fakeLoans'
import { LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil } from './fixtures/ledger'
import { percent } from './fixtures/loans'

const TODAY = civil('2026-10-28')

function sample() {
  const { workbook } = LOANS_DOCUMENT.read({
    meta: { id: 'tries', source: 'browser', title: 'tries', syncedAt: '2026-10-28T00:00:00Z', lastExportedAt: null, unexportedSince: null },
    revision: '1',
    document: fakeLoansDocument('2026-10-28T00:00:00Z', 'sample'),
  })
  return workbook
}

describe("the tries saved on a loan's page", () => {
  it("reads the sample's three Home loan scenarios, works each out from today and says what it saves", () => {
    const workbook = sample()
    const tries = savedTries(workbook.bankLoans[0]!, workbook.scenarios, TODAY, words)

    expect(tries.map((entry) => entry.title)).toEqual(['€5,000 next spring', '€150 every month', 'Move to Jadran Bank'])
    expect(tries.map((entry) => entry.detail)).toEqual([
      'Extra €5,000.00 on 20 Apr 2027, shorter term. €5,501.10 less interest, 11 m sooner',
      'Extra €150.00 every month from 20 Jan 2027, shorter term. €15,927.37 less interest, 4 y 4 m sooner',
      'A new loan from Jadran Bank pays this one off on 20 Mar 2028: 2.9% fixed over 240 instalments, costs €1,500.00 up front. Its costs are paid back by 31 Jan 2030. €17,102.59 less interest',
    ])
  })

  it('says why Kuna cannot work a try out', () => {
    const workbook = sample()
    const [spring] = workbook.scenarios
    const offDue = { ...spring!, changes: [{ ...spring!.changes[0]!, kind: 'rate-change', from: civil('2027-04-21'), rate: percent('3'), rateType: 'fixed' } as const] }
    const [tried] = savedTries(workbook.bankLoans[0]!, [offDue], TODAY, words)

    expect(tried!.detail).toBe('The rate is 3% fixed from 21 Apr 2027. 21 Apr 2027 is not a due date of Home loan.')
  })

  it('keeps no try of another loan', () => {
    const workbook = sample()

    expect(savedTries({ ...workbook.bankLoans[0]!, loan: { ...workbook.bankLoans[0]!.loan, id: recordIdOf(BANK_LOAN_RECORDS, 'other') } }, workbook.scenarios, TODAY, words)).toEqual([])
  })
})

describe('a shorter term on the subsidised sample loan', () => {
  // The Home loan has 257 instalments left from 20 Nov 2026. Fifteen years from then is 180 of them.
  const workbook = sample()
  const book = workbook.bankLoans[0]!
  const shorter = { kind: 'term-change', from: civil('2026-11-20'), instalments: 180 } as const

  it('keeps the APN subsidy and the 2028 variable rate, and asks no subsidy back', () => {
    const plan = scenarioPlan({ ...book, costs: NO_COSTS }, [shorter], TODAY)
    if ('refused' in plan) throw new Error(plan.refused)
    const outcome = scenarioOutcome(plan, TODAY)
    const subsidised = plan.rows.filter((row) => row.subsidy > 0)

    expect(subsidised.at(-1)!.date).toBe('2027-03-20')
    expect(outcome.variableFrom).toBe('2028-04-20')
    expect(outcome.payoff).toBe('2041-10-20')
    expect(outcome.subsidyPayback).toBeNull()
  })

  it('raises the instalment and saves interest against the loan as it stands', () => {
    const tried = whatIfChange(book, shorter)!
    const before = book.plan!.find((row) => row.kind === 'instalment' && row.date === '2026-11-20')!

    expect(tried.nextInstalment).toBeGreaterThan(before.payment)
    expect(tried.interestSaved).toBeGreaterThan(0)
    expect(tried.monthsSaved).toBe(77)
  })
})

describe('a rate change tried on the sample loan', () => {
  it('keeps the kind of the rate in force, and a lower rate saves interest', () => {
    const book = sample().bankLoans[0]!
    const change = triedRate(book, civil('2026-11-20'), percent('3'))

    expect(change).toEqual({ kind: 'rate-change', from: '2026-11-20', rate: percent('3'), rateType: 'fixed' })
    expect(triedRate(book, civil('2028-05-20'), percent('3'))).toMatchObject({ rateType: 'variable' })
    expect(whatIfChange(book, change)!.interestSaved).toBeGreaterThan(0)
  })
})
