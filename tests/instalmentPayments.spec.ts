import { describe, expect, it } from 'vitest'

import { statementPaymentsFrom } from '../src/apps/loans/bankLoans/application/statementPayments'
import { instalmentStandings } from '../src/apps/loans/bankLoans/domain/instalmentPayments'
import type { StatementPayment } from '../src/apps/loans/bankLoans/domain/instalmentPayments'
import { loanPlan } from '../src/apps/loans/bankLoans/domain/loanPlan'
import { BANK_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { PublishedRowLink } from '../src/shared/app/rowLinks'
import { accountMoneyOfEuros } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { bankLoan, lateInstalment, LOAN_UUID, OTHER_UUID, ratePeriod } from './fixtures/loans'

const loan = bankLoan()
const periods = [ratePeriod(loan, '2026-02-05', '12')]
const plan = loanPlan(loan, periods, [])

function paid(due: string, booked: string, of = loan.id): StatementPayment {
  return { loan: of, due: civil(due), booked: civil(booked) }
}

describe("how a bank loan's instalments stand against your statements", () => {
  it('leaves every instalment as planned while no row is linked, and one with a late record late on its day', () => {
    const standings = instalmentStandings({ loan, plan, lateInstalments: [lateInstalment(loan, '2026-03-05', '2026-03-09')] }, [], civil('2026-12-31'))

    expect(standings.get(civil('2026-02-05'))).toEqual({ standing: 'as-planned' })
    expect(standings.get(civil('2026-03-05'))).toEqual({ standing: 'recorded', paid: '2026-03-09' })
    expect(standings.size).toBe(12)
  })

  it('calls a passed instalment not seen only from the first linked one on and after the bank has had 7 days to book it', () => {
    const standings = instalmentStandings({ loan, plan, lateInstalments: [] }, [paid('2026-04-05', '2026-04-04')], civil('2026-06-12'))

    expect([...standings].slice(1, 5)).toEqual([
      ['2026-03-05', { standing: 'as-planned' }],
      ['2026-04-05', { standing: 'seen', paid: '2026-04-04', overruled: null }],
      ['2026-05-05', { standing: 'not-seen' }],
      // Due 7 days before the day, so the bank may still book it.
      ['2026-06-05', { standing: 'as-planned' }],
    ])
  })

  it('takes the linked row over a late record of another day, and the latest row when several pay one instalment', () => {
    const late = lateInstalment(loan, '2026-03-05', '2026-03-09')
    const agreeing = lateInstalment(loan, '2026-04-05', '2026-04-07')
    const payments = [paid('2026-03-05', '2026-03-06'), paid('2026-03-05', '2026-03-12'), paid('2026-04-05', '2026-04-07')]

    const standings = instalmentStandings({ loan, plan, lateInstalments: [late, agreeing] }, payments, civil('2026-04-30'))

    expect(standings.get(civil('2026-03-05'))).toEqual({ standing: 'seen', paid: '2026-03-12', overruled: late })
    expect(standings.get(civil('2026-04-05'))).toEqual({ standing: 'seen', paid: '2026-04-07', overruled: null })
  })

  it('reads a row linked to another loan or to a due the plan no longer has as nothing, and unchecked statements as no row at all', () => {
    const elsewhere = [paid('2026-03-05', '2026-03-05', recordIdOf(BANK_LOAN_RECORDS, OTHER_UUID)), paid('2026-03-06', '2026-03-06')]

    const standings = instalmentStandings({ loan, plan, lateInstalments: [] }, elsewhere, civil('2026-12-31'))
    const unchecked = instalmentStandings({ loan, plan, lateInstalments: [] }, 'unchecked', civil('2026-12-31'))

    expect([...standings.values()].every((standing) => standing.standing === 'as-planned')).toBe(true)
    expect([...unchecked.values()].every((standing) => standing.standing === 'as-planned')).toBe(true)
  })
})

describe("the statement rows Loans reads from the shell's linked rows", () => {
  function linked(target: PublishedRowLink['target'], day = '2026-03-04'): PublishedRowLink {
    return { row: 'row', item: 'row', account: 'account', day: civil(day), amount: accountMoneyOfEuros(euros(-100)), currency: EURO, target }
  }

  it("takes Spending's rows linked to a Loans instalment, each item on its own, and leaves out other targets", () => {
    const instalment = linked({ app: 'loans', kind: 'bank-loan', key: LOAN_UUID, due: civil('2026-03-05') })
    const links = [
      instalment,
      instalment,
      linked({ app: 'loans', kind: 'informal-loan', key: OTHER_UUID, due: null }),
      linked({ app: 'assets', kind: 'bank-loan', key: LOAN_UUID, due: civil('2026-03-05') }),
    ]

    expect(
      statementPaymentsFrom(
        [
          { app: 'company', links: 'failed' },
          { app: 'spending', links },
        ],
        'loans',
      ),
    ).toEqual([paid('2026-03-05', '2026-03-04'), paid('2026-03-05', '2026-03-04')])
  })

  it('gives no rows while Spending opens or is not set up, and leaves the instalments unchecked when it failed to open', () => {
    expect(statementPaymentsFrom([{ app: 'spending', links: 'opening' }], 'loans')).toEqual([])
    expect(statementPaymentsFrom([{ app: 'spending', links: null }], 'loans')).toEqual([])
    expect(statementPaymentsFrom([], 'loans')).toEqual([])
    expect(statementPaymentsFrom([{ app: 'spending', links: 'failed' }], 'loans')).toBe('unchecked')
  })
})
