import { bookWith, dependentRefusals } from '../../workbook/application/loanWriteGuards'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, LATE_INSTALMENT_RECORDS, RATE_PERIOD_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { LoansRecords } from '../../workbook/domain/readLoanBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** Every bank loan kind, since the plan that a late instalment's due date must be on reads them all. */
const BANK_LOAN_KINDS = [BANK_LOAN_RECORDS, RATE_PERIOD_RECORDS, EXTRA_PAYMENT_RECORDS, LATE_INSTALMENT_RECORDS]

/** A bank loan keeps the rate periods, extra payments and late instalments that name it. */
export const BANK_LOAN_WRITES: WriteRules<BankLoan> = {
  kind: BANK_LOAN_RECORDS,
  reads: BANK_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(BANK_LOAN_RECORDS, read, records).readings.bankLoans,
  refusals: (_change, fresh, after) => dependentRefusals(['ratePeriods', 'extraPayments', 'lateInstalments'], fresh, after),
}

/** A rate period leaves its loan with a rate from its first instalment, and keeps the due dates late instalments name. */
export const RATE_PERIOD_WRITES: WriteRules<RatePeriod> = {
  kind: RATE_PERIOD_RECORDS,
  reads: BANK_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(RATE_PERIOD_RECORDS, read, records).readings.ratePeriods,
  refusals: (_change, fresh, after) => dependentRefusals(['bankLoans', 'lateInstalments'], fresh, after),
}

/** An extra payment keeps the due dates late instalments name, which a shorter term could end before. */
export const EXTRA_PAYMENT_WRITES: WriteRules<ExtraPayment> = {
  kind: EXTRA_PAYMENT_RECORDS,
  reads: BANK_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(EXTRA_PAYMENT_RECORDS, read, records).readings.extraPayments,
  refusals: (_change, fresh, after) => dependentRefusals(['lateInstalments'], fresh, after),
}

export const LATE_INSTALMENT_WRITES: WriteRules<LateInstalment> = {
  kind: LATE_INSTALMENT_RECORDS,
  reads: BANK_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LATE_INSTALMENT_RECORDS, read, records).readings.lateInstalments,
  refusals: () => [],
}

/** Deletes the bank loan and every record that names it in one write, so one Undo puts them all back. */
export function removeBankLoan(unit: UnitOfWork, records: LoansRecords, loan: BankLoan): void {
  unit.of(BANK_LOAN_WRITES).remove(loan)
  records.ratePeriods.records.filter((stored) => stored.record.loan === loan.id).forEach((stored) => unit.of(RATE_PERIOD_WRITES).remove(stored.record))
  records.extraPayments.records.filter((stored) => stored.record.loan === loan.id).forEach((stored) => unit.of(EXTRA_PAYMENT_WRITES).remove(stored.record))
  records.lateInstalments.records.filter((stored) => stored.record.loan === loan.id).forEach((stored) => unit.of(LATE_INSTALMENT_WRITES).remove(stored.record))
}

/** A new bank loan from its typed terms, its text trimmed, with an id of its own. */
export function newBankLoan(terms: Omit<BankLoan, 'id'>): BankLoan {
  return { ...terms, name: terms.name.trim(), lender: terms.lender.trim(), note: terms.note.trim(), id: recordIdOf(BANK_LOAN_RECORDS, newRecordId()) }
}

export function newRatePeriod(period: Omit<RatePeriod, 'id'>): RatePeriod {
  return { ...period, note: period.note.trim(), id: recordIdOf(RATE_PERIOD_RECORDS, newRecordId()) }
}

export function newExtraPayment(payment: Omit<ExtraPayment, 'id'>): ExtraPayment {
  return { ...payment, id: recordIdOf(EXTRA_PAYMENT_RECORDS, newRecordId()) }
}

export function newLateInstalment(late: Omit<LateInstalment, 'id'>): LateInstalment {
  return { ...late, id: recordIdOf(LATE_INSTALMENT_RECORDS, newRecordId()) }
}
