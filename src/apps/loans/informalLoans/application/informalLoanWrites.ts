import { bookWith, dependentRefusals } from '../../workbook/application/loanWriteGuards'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import { INFORMAL_LOAN_RECORDS, MOVEMENT_RECORDS } from '../../workbook/domain/loanKinds'
import type { Movement } from '../../workbook/domain/movement'
import type { LoansRecords } from '../../workbook/domain/readLoanBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

const INFORMAL_LOAN_KINDS = [INFORMAL_LOAN_RECORDS, MOVEMENT_RECORDS]

/** An informal loan keeps the movements that name it. */
export const INFORMAL_LOAN_WRITES: WriteRules<InformalLoan> = {
  kind: INFORMAL_LOAN_RECORDS,
  reads: INFORMAL_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(INFORMAL_LOAN_RECORDS, read, records).readings.informalLoans,
  refusals: (_change, fresh, after) => dependentRefusals(['movements'], fresh, after),
}

export const MOVEMENT_WRITES: WriteRules<Movement> = {
  kind: MOVEMENT_RECORDS,
  reads: INFORMAL_LOAN_KINDS,
  undoable: true,
  read: (read, records) => bookWith(MOVEMENT_RECORDS, read, records).readings.movements,
  refusals: () => [],
}

/** Deletes the informal loan and its movements in one write, so one Undo puts them all back. */
export function removeInformalLoan(unit: UnitOfWork, records: LoansRecords, loan: InformalLoan): void {
  unit.of(INFORMAL_LOAN_WRITES).remove(loan)
  records.movements.records.filter((stored) => stored.record.loan === loan.id).forEach((stored) => unit.of(MOVEMENT_WRITES).remove(stored.record))
}

/** A new informal loan, its text trimmed, with an id of its own. */
export function newInformalLoan(loan: Omit<InformalLoan, 'id'>): InformalLoan {
  return { ...loan, name: loan.name.trim(), counterparty: loan.counterparty.trim(), note: loan.note.trim(), id: recordIdOf(INFORMAL_LOAN_RECORDS, newRecordId()) }
}

export function newMovement(movement: Omit<Movement, 'id'>): Movement {
  return { ...movement, note: movement.note.trim(), id: recordIdOf(MOVEMENT_RECORDS, newRecordId()) }
}
