import { rateOfText } from '../../src/apps/loans/bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../src/apps/loans/bankLoans/domain/yearlyRate'
import type { BankLoan } from '../../src/apps/loans/workbook/domain/bankLoan'
import type { ExtraPayment } from '../../src/apps/loans/workbook/domain/extraPayment'
import type { InformalLoan } from '../../src/apps/loans/workbook/domain/informalLoan'
import type { LateInstalment } from '../../src/apps/loans/workbook/domain/lateInstalment'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, LATE_INSTALMENT_RECORDS, MOVEMENT_RECORDS, RATE_PERIOD_RECORDS } from '../../src/apps/loans/workbook/domain/loanKinds'
import type { Movement } from '../../src/apps/loans/workbook/domain/movement'
import type { RatePeriod } from '../../src/apps/loans/workbook/domain/ratePeriod'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import { civil, euros } from './ledger'

export const LOAN_UUID = '0b6f3c1e-5d2a-4e8f-9a71-3c4d5e6f7a80'
export const OTHER_UUID = '1c7a4d2f-6e3b-4f90-8b82-4d5e6f7a8b91'

export function percent(text: string): YearlyRate {
  const rate = rateOfText(text)
  if (rate === null) throw new Error(`${text} is not a rate`)
  return rate
}

/** 1,200.00 drawn on 2026-01-05 and repaid in 12 instalments from 2026-02-05, a size whose figures can be worked out by hand. */
export function bankLoan(overrides: Partial<BankLoan> = {}): BankLoan {
  return {
    id: recordIdOf(BANK_LOAN_RECORDS, LOAN_UUID),
    name: 'Car loan',
    lender: 'Example Bank',
    principal: euros(1200),
    drawdown: civil('2026-01-05'),
    firstInstalment: civil('2026-02-05'),
    instalments: 12,
    interimInterest: null,
    subsidy: null,
    note: '',
    ...overrides,
  }
}

export function ratePeriod(loan: BankLoan, from: string, rate: string, key = from): RatePeriod {
  return { id: recordIdOf(RATE_PERIOD_RECORDS, `period-${key}`), loan: loan.id, from: civil(from), rate: percent(rate), rateType: 'fixed', note: '' }
}

export function extraPayment(loan: BankLoan, date: string, amount: number, effect: ExtraPayment['effect']): ExtraPayment {
  return { id: recordIdOf(EXTRA_PAYMENT_RECORDS, `extra-${date}`), loan: loan.id, date: civil(date), amount: euros(amount), effect }
}

export function lateInstalment(loan: BankLoan, due: string, paid: string): LateInstalment {
  return { id: recordIdOf(LATE_INSTALMENT_RECORDS, `late-${due}`), loan: loan.id, due: civil(due), paid: civil(paid) }
}

/** 3,000.00 borrowed from a friend on 2026-03-01. */
export function informalLoan(overrides: Partial<InformalLoan> = {}): InformalLoan {
  return {
    id: recordIdOf(INFORMAL_LOAN_RECORDS, OTHER_UUID),
    name: 'From Ana',
    counterparty: 'Ana',
    direction: 'you-owe',
    openingBalance: euros(3000),
    start: civil('2026-03-01'),
    note: '',
    ...overrides,
  }
}

export function movement(loan: InformalLoan, date: string, kind: Movement['kind'], amount: number, key = `${date}-${kind}`): Movement {
  return { id: recordIdOf(MOVEMENT_RECORDS, `movement-${key}`), loan: loan.id, date: civil(date), kind, amount: euros(amount), note: '' }
}
