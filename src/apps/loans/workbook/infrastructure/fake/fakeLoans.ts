import { rateOfText } from '../../../bankLoans/domain/yearlyRate'
import { codecOfLoansKind } from '../../application/loansCodecs'
import type { BankLoan } from '../../domain/bankLoan'
import type { ExtraPayment } from '../../domain/extraPayment'
import type { InformalLoan } from '../../domain/informalLoan'
import type { LateInstalment } from '../../domain/lateInstalment'
import type { LoanChange, LoanScenario, ScenarioChange } from '../../../scenarios/domain/loanScenario'
import {
  BANK_LOAN_RECORDS,
  EXTRA_PAYMENT_RECORDS,
  INFORMAL_LOAN_RECORDS,
  LATE_INSTALMENT_RECORDS,
  LOAN_SCENARIO_RECORDS,
  MOVEMENT_RECORDS,
  RATE_PERIOD_RECORDS,
  SCENARIO_CHANGE_RECORDS,
} from '../../domain/loanKinds'
import type { Movement } from '../../domain/movement'
import type { RatePeriod } from '../../domain/ratePeriod'
import { emptyLoansDocument } from '../loansDocument'
import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'

function day(text: string): CivilDate {
  const parsed = parseCivilDate(text)
  if (parsed === null) throw new Error(`${text} is not a day.`)
  return parsed
}

const euros = (amount: number): Money => moneyFromAmount(amount)

/** A fixed id per record, so every load of the sample holds the same records. */
function fixedId(kind: RecordKind, place: number): RecordId {
  return recordIdOf(kind, `fa4e0000-0000-4000-8000-${String(place).padStart(12, '0')}`)
}

function rate(text: string): RatePeriod['rate'] {
  const parsed = rateOfText(text)
  if (parsed === null) throw new Error(`${text} is not a rate.`)
  return parsed
}

/**
 * A made-up home loan over 25 years: fixed for five years and variable after, a subsidy for its first
 * four years, interest before the first instalment, an extra payment for a lower instalment and one
 * instalment paid late.
 */
const HOME_LOAN: BankLoan = {
  id: fixedId(BANK_LOAN_RECORDS, 1),
  name: 'Home loan',
  lender: 'Example Bank',
  principal: euros(180_000),
  drawdown: day('2023-03-10'),
  firstInstalment: day('2023-04-20'),
  instalments: 300,
  interimInterest: { amount: euros(210.5), date: day('2023-04-20') },
  subsidy: { monthly: euros(210), firstInstalment: 1, instalments: 48, payer: 'APN' },
  note: 'Made up for the fake build.',
}

const RATE_PERIODS: readonly RatePeriod[] = [
  { id: fixedId(RATE_PERIOD_RECORDS, 2), loan: HOME_LOAN.id, from: day('2023-04-20'), rate: rate('3.1'), rateType: 'fixed', note: 'Fixed for the first five years' },
  { id: fixedId(RATE_PERIOD_RECORDS, 3), loan: HOME_LOAN.id, from: day('2028-04-20'), rate: rate('3.85'), rateType: 'variable', note: '6M EURIBOR + 1.20' },
]

const EXTRA_PAYMENTS: readonly ExtraPayment[] = [{ id: fixedId(EXTRA_PAYMENT_RECORDS, 4), loan: HOME_LOAN.id, date: day('2025-06-15'), amount: euros(8000), effect: 'lower-instalment' }]

const LATE_INSTALMENTS: readonly LateInstalment[] = [{ id: fixedId(LATE_INSTALMENT_RECORDS, 5), loan: HOME_LOAN.id, due: day('2024-12-20'), paid: day('2025-01-07') }]

/** A made-up loan from a friend, with a movement of every kind, borrowing back among them. */
const FROM_MARKO: InformalLoan = {
  id: fixedId(INFORMAL_LOAN_RECORDS, 6),
  name: 'From Marko',
  counterparty: 'Marko',
  direction: 'you-owe',
  openingBalance: euros(12_000),
  start: day('2024-05-01'),
  note: '',
}

const MOVEMENTS: readonly Movement[] = (
  [
    ['2024-06-30', 'repaid', 500, ''],
    ['2024-07-31', 'repaid', 500, ''],
    ['2024-09-15', 'borrowed', 2000, 'Car repair'],
    ['2024-11-02', 'repaid-in-kind', 350, 'Paid his phone bill'],
    ['2025-02-14', 'borrowed-in-kind', 640, 'He bought a boat battery for me'],
    ['2025-12-24', 'forgiven', 1000, 'A Christmas present'],
    ['2026-09-30', 'repaid', 1500, ''],
  ] as const
).map(([date, kind, amount, note], index) => ({ id: fixedId(MOVEMENT_RECORDS, 7 + index), loan: FROM_MARKO.id, date: day(date), kind, amount: euros(amount), note }))

/**
 * Three made-up scenarios of the home loan, an extra payment inside the subsidy's payback window, a
 * regular one and a move to another bank after the last fixed-rate instalment, and two made-up offers, one fixed
 * with a printed EKS and one fixed for five years and variable after.
 */
const NEXT_SPRING: LoanScenario = { id: fixedId(LOAN_SCENARIO_RECORDS, 20), name: '€5,000 next spring', start: { kind: 'loan', loan: HOME_LOAN.id } }
const EVERY_MONTH: LoanScenario = { id: fixedId(LOAN_SCENARIO_RECORDS, 21), name: '€150 every month', start: { kind: 'loan', loan: HOME_LOAN.id } }
const MOVE: LoanScenario = { id: fixedId(LOAN_SCENARIO_RECORDS, 22), name: 'Move to Jadran Bank', start: { kind: 'loan', loan: HOME_LOAN.id } }

const JADRAN: LoanScenario = {
  id: fixedId(LOAN_SCENARIO_RECORDS, 23),
  name: 'Jadran Bank offer',
  start: {
    kind: 'offer',
    terms: {
      lender: 'Jadran Bank',
      principal: euros(140_000),
      drawdown: day('2026-12-01'),
      firstInstalment: day('2027-01-01'),
      instalments: 300,
      interimInterest: null,
      subsidy: null,
      costs: { upfront: euros(800), monthly: euros(0), yearly: euros(35) },
      bankEks: rate('3.09'),
    },
  },
}

const COASTAL: LoanScenario = {
  id: fixedId(LOAN_SCENARIO_RECORDS, 24),
  name: 'Coastal Bank offer',
  start: {
    kind: 'offer',
    terms: {
      lender: 'Coastal Bank',
      principal: euros(140_000),
      drawdown: day('2026-12-10'),
      firstInstalment: day('2027-01-10'),
      instalments: 360,
      interimInterest: { amount: euros(373.33), date: day('2027-01-10') },
      subsidy: null,
      costs: { upfront: euros(0), monthly: euros(2), yearly: euros(0) },
      bankEks: null,
    },
  },
}

function changeOf(place: number, scenario: LoanScenario, change: LoanChange): ScenarioChange {
  return { ...change, id: fixedId(SCENARIO_CHANGE_RECORDS, place), scenario: scenario.id }
}

const SCENARIO_CHANGES: readonly ScenarioChange[] = [
  changeOf(25, NEXT_SPRING, { kind: 'extra-payment', date: day('2027-04-20'), amount: euros(5000), effect: 'shorter-term' }),
  changeOf(26, EVERY_MONTH, { kind: 'regular-extra-payment', from: day('2027-01-20'), every: 'month', until: null, amount: euros(150), effect: 'shorter-term' }),
  changeOf(27, MOVE, {
    kind: 'move',
    on: day('2028-03-20'),
    lender: 'Jadran Bank',
    rate: rate('2.9'),
    rateType: 'fixed',
    instalments: 240,
    costs: { upfront: euros(1500), monthly: euros(0), yearly: euros(0) },
  }),
  changeOf(28, JADRAN, { kind: 'rate-change', from: day('2027-01-01'), rate: rate('2.95'), rateType: 'fixed' }),
  changeOf(29, COASTAL, { kind: 'rate-change', from: day('2027-01-10'), rate: rate('3.2'), rateType: 'fixed' }),
  changeOf(30, COASTAL, { kind: 'rate-change', from: day('2032-01-10'), rate: rate('3.6'), rateType: 'variable' }),
]

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  const codec = codecOfLoansKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/** A made-up car loan over five years at a fixed rate, which ends long before the home loan. */
const CAR_LOAN: BankLoan = {
  id: fixedId(BANK_LOAN_RECORDS, 30),
  name: 'Car loan',
  lender: 'Example Bank',
  principal: euros(24_000),
  drawdown: day('2024-09-02'),
  firstInstalment: day('2024-10-05'),
  instalments: 60,
  interimInterest: null,
  subsidy: null,
  note: 'Made up for the fake build.',
}

const CAR_RATE_PERIODS: readonly RatePeriod[] = [{ id: fixedId(RATE_PERIOD_RECORDS, 31), loan: CAR_LOAN.id, from: day('2024-10-05'), rate: rate('5.49'), rateType: 'fixed', note: '' }]

/** The fake build's made-up Loans files: `sample` with a bank loan and an informal loan, `one-loan` with the bank loan alone, and `house-and-car` with the home loan and a car loan. */
export type FakeLoansSet = 'sample' | 'one-loan' | 'house-and-car'

/** The Loans file of the set, which the fake build keeps on the fake Drive. Every figure in it is made up, and its scenarios and offers are never counted as loans. */
export function fakeLoansDocument(savedAt: string, set: FakeLoansSet = 'sample'): WorkbookDocument {
  const withInformalLoan = set === 'sample'
  const withCar = set === 'house-and-car'
  return {
    ...emptyLoansDocument(savedAt),
    records: {
      ...stored(BANK_LOAN_RECORDS, withCar ? [HOME_LOAN, CAR_LOAN] : [HOME_LOAN]),
      ...stored(RATE_PERIOD_RECORDS, withCar ? [...RATE_PERIODS, ...CAR_RATE_PERIODS] : RATE_PERIODS),
      ...stored(EXTRA_PAYMENT_RECORDS, EXTRA_PAYMENTS),
      ...stored(LATE_INSTALMENT_RECORDS, LATE_INSTALMENTS),
      ...stored(INFORMAL_LOAN_RECORDS, withInformalLoan ? [FROM_MARKO] : []),
      ...stored(MOVEMENT_RECORDS, withInformalLoan ? MOVEMENTS : []),
      ...stored(LOAN_SCENARIO_RECORDS, [NEXT_SPRING, EVERY_MONTH, MOVE, JADRAN, COASTAL]),
      ...stored(SCENARIO_CHANGE_RECORDS, SCENARIO_CHANGES),
    },
  }
}
