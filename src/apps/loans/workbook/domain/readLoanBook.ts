import type { BankLoan } from './bankLoan'
import type { ExtraPayment } from './extraPayment'
import type { InformalLoan } from './informalLoan'
import type { LateInstalment } from './lateInstalment'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, LATE_INSTALMENT_RECORDS, MOVEMENT_RECORDS, RATE_PERIOD_RECORDS } from './loanKinds'
import type { Movement } from './movement'
import type { RatePeriod } from './ratePeriod'
import { loanPlan } from '../../bankLoans/domain/loanPlan'
import type { PlanRow } from '../../bankLoans/domain/loanPlan'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { SHARED_ID_REASON, idSharing, problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'

/** What the Loans file holds of each kind. */
export interface LoansRecords {
  readonly bankLoans: RecordsRead<BankLoan>
  readonly ratePeriods: RecordsRead<RatePeriod>
  readonly extraPayments: RecordsRead<ExtraPayment>
  readonly lateInstalments: RecordsRead<LateInstalment>
  readonly informalLoans: RecordsRead<InformalLoan>
  readonly movements: RecordsRead<Movement>
}

/** The kind each part of the records holds. */
export const LOAN_PARTS: { readonly [Part in keyof LoansRecords]: RecordKind<LoansRecords[Part]['records'][number]['record']> } = {
  bankLoans: BANK_LOAN_RECORDS,
  ratePeriods: RATE_PERIOD_RECORDS,
  extraPayments: EXTRA_PAYMENT_RECORDS,
  lateInstalments: LATE_INSTALMENT_RECORDS,
  informalLoans: INFORMAL_LOAN_RECORDS,
  movements: MOVEMENT_RECORDS,
}

/** The records of every Loans kind, as `of` gives each kind. */
export function loansRecordsOf(of: <R>(kind: RecordKind<R>) => RecordsRead<R>): LoansRecords {
  return {
    bankLoans: of(LOAN_PARTS.bankLoans),
    ratePeriods: of(LOAN_PARTS.ratePeriods),
    extraPayments: of(LOAN_PARTS.extraPayments),
    lateInstalments: of(LOAN_PARTS.lateInstalments),
    informalLoans: of(LOAN_PARTS.informalLoans),
    movements: of(LOAN_PARTS.movements),
  }
}

/** Which records of each kind count, and why the rest do not or are doubted. */
export type LoanReadings = { readonly [Part in keyof LoansRecords]: Reading<LoansRecords[Part]['records'][number]['record']> }

/** A bank loan with the records that name it, and its plan, null while no rate period starts at its first instalment. */
export interface BankLoanBook {
  readonly loan: BankLoan
  readonly ratePeriods: readonly RatePeriod[]
  readonly extraPayments: readonly ExtraPayment[]
  readonly lateInstalments: readonly LateInstalment[]
  readonly plan: readonly PlanRow[] | null
}

export interface InformalLoanBook {
  readonly loan: InformalLoan
  readonly movements: readonly Movement[]
}

/** A record problem with the kind of the record it is about. */
export interface LoanProblem extends RecordProblem {
  readonly kind: string
}

export interface LoanBook {
  readonly bankLoans: readonly BankLoanBook[]
  readonly informalLoans: readonly InformalLoanBook[]
  readonly readings: LoanReadings
  /** Every kind's problems, in the order of the kinds. */
  readonly problems: readonly LoanProblem[]
}

/** The records the reasons leave in, the rest as problems, after the problems of records the factory refused and of ids two records share. */
function readEach<R>(read: RecordsRead<R>, reasonsOf: (stored: ReadRecord<R>) => readonly string[]): Reading<R> {
  const sharesId = idSharing(read)
  const facts: R[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const reasons = sharesId(stored) ? [SHARED_ID_REASON] : reasonsOf(stored)
    if (reasons.length === 0) facts.push(stored.record)
    problems.push(...reasons.map((reason) => problemOf(stored, reason)))
  }
  return { facts, problems }
}

/** The due date of each instalment of the loan as signed, on the first instalment's day of each month. */
function dueDates(loan: BankLoan): Set<CivilDate> {
  return new Set(Array.from({ length: loan.instalments }, (_, offset) => dayMonthsLater(loan.firstInstalment, offset)))
}

/** The pairs of a loan and a day, as `day` picks it, that more than one record of `read` holds. */
function sharingDay<R extends { readonly loan: RecordId }>(read: RecordsRead<R>, day: (record: R) => CivilDate): ReadonlySet<string> {
  return sharedKeys(read.records, (stored) => `${stored.record.loan} ${day(stored.record)}`)
}

/**
 * Reads the Loans file with the rules across records. A record that names a loan names one of the
 * right kind that counts, and its date is not before the loan starts. A loan's rate periods start on
 * its due dates, one of them at its first instalment, and no two on the same day, so they leave no
 * gap and do not overlap. A late instalment names a due date of its loan's plan, once. A bank loan
 * without a rate period at its first instalment counts but is doubted, since its plan cannot be
 * worked out.
 */
export function readLoanBook(records: LoansRecords): LoanBook {
  const bankLoanReading = readEach(records.bankLoans, () => [])
  const bankLoans = new Map(bankLoanReading.facts.map((loan) => [loan.id, loan]))
  const missingBankLoan = 'names no bank loan in the file'

  const periodsSharingDay = sharingDay(records.ratePeriods, (period) => period.from)
  const earliestFrom = new Map<RecordId, CivilDate>()
  for (const { record } of records.ratePeriods.records) {
    const held = earliestFrom.get(record.loan)
    if (held === undefined || record.from < held) earliestFrom.set(record.loan, record.from)
  }
  const ratePeriods = readEach(records.ratePeriods, ({ record: period }) => {
    const loan = bankLoans.get(period.loan)
    if (loan === undefined) return [missingBankLoan]
    if (!dueDates(loan).has(period.from)) return [`from ${period.from} is not a due date of "${loan.name}"`]
    if (periodsSharingDay.has(`${period.loan} ${period.from}`)) return [`another rate period of "${loan.name}" starts on ${period.from} too`]
    if (period.from === earliestFrom.get(period.loan) && period.from !== loan.firstInstalment) {
      return [`from ${period.from} leaves the instalments of "${loan.name}" from ${loan.firstInstalment} without a rate`]
    }
    return []
  })

  const extraPayments = readEach(records.extraPayments, ({ record: payment }) => {
    const loan = bankLoans.get(payment.loan)
    if (loan === undefined) return [missingBankLoan]
    return payment.date < loan.drawdown ? [`date ${payment.date} is before "${loan.name}" was drawn on ${loan.drawdown}`] : []
  })

  const plans = new Map(
    bankLoanReading.facts.map((loan) => {
      const periods = ratePeriods.facts.filter((period) => period.loan === loan.id)
      const planned = periods.some((period) => period.from === loan.firstInstalment)
      return [
        loan.id,
        planned
          ? loanPlan(
              loan,
              periods,
              extraPayments.facts.filter((payment) => payment.loan === loan.id),
            )
          : null,
      ] as const
    }),
  )
  const unplanned = records.bankLoans.records
    .filter((stored) => plans.get(stored.record.id) === null)
    .map((stored) => problemOf(stored, `no rate period starts at its first instalment on ${stored.record.firstInstalment}, so its plan cannot be worked out`))

  const latesSharingDue = sharingDay(records.lateInstalments, (late) => late.due)
  const lateInstalments = readEach(records.lateInstalments, ({ record: late }) => {
    const loan = bankLoans.get(late.loan)
    if (loan === undefined) return [missingBankLoan]
    const plan = plans.get(loan.id) ?? null
    const due = plan === null ? dueDates(loan) : new Set(plan.filter((row) => row.kind === 'instalment').map((row) => row.date))
    if (!due.has(late.due)) return [`due ${late.due} is not a due date of "${loan.name}"`]
    return latesSharingDue.has(`${late.loan} ${late.due}`) ? [`another late instalment of "${loan.name}" names the due date ${late.due} too`] : []
  })

  const informalLoanReading = readEach(records.informalLoans, () => [])
  const informalLoans = new Map(informalLoanReading.facts.map((loan) => [loan.id, loan]))
  const movements = readEach(records.movements, ({ record: movement }) => {
    const loan = informalLoans.get(movement.loan)
    if (loan === undefined) return ['names no informal loan in the file']
    return movement.date < loan.start ? [`date ${movement.date} is before "${loan.name}" starts on ${loan.start}`] : []
  })

  const readings: LoanReadings = {
    bankLoans: { facts: bankLoanReading.facts, problems: [...bankLoanReading.problems, ...unplanned] },
    ratePeriods,
    extraPayments,
    lateInstalments,
    informalLoans: informalLoanReading,
    movements,
  }
  return {
    bankLoans: bankLoanReading.facts.map((loan) => ({
      loan,
      ratePeriods: ratePeriods.facts.filter((period) => period.loan === loan.id).sort((earlier, later) => earlier.from.localeCompare(later.from)),
      extraPayments: extraPayments.facts.filter((payment) => payment.loan === loan.id),
      lateInstalments: lateInstalments.facts.filter((late) => late.loan === loan.id),
      plan: plans.get(loan.id) ?? null,
    })),
    informalLoans: informalLoanReading.facts.map((loan) => ({ loan, movements: movements.facts.filter((movement) => movement.loan === loan.id) })),
    readings,
    problems: (Object.keys(LOAN_PARTS) as (keyof LoansRecords)[]).flatMap((part) => readings[part].problems.map((problem) => ({ kind: LOAN_PARTS[part].name, ...problem }))),
  }
}
