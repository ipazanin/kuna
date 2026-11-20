import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { HELD_STATEMENT_RECORDS } from '../../workbook/domain/coreKinds'
import { isHeldStatement } from '../../workbook/domain/heldStatements'
import type { HeldStatement, HeldStatementKey } from '../../workbook/domain/heldStatements'
import { readHeldStatements } from '../../workbook/domain/heldStatementsReading'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { DryRunStatement } from '../domain/importDryRun'
import type { StatementReading } from '../domain/importedStatement'

/** The statements the sync holds, checked by their own reader. Nothing else reads them, so nothing else can refuse them. */
export const HELD_STATEMENT_WRITES: WriteRules<HeldStatement> = {
  kind: HELD_STATEMENT_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readHeldStatements(read),
  refusals: () => [],
}

/** Where a statement the sync holds came from: its mail, the day the mail came, and its attachment and label. */
export interface MailedStatement extends HeldStatementKey {
  readonly mailId: string
  readonly mailedOn: CivilDate
}

/** A statement the person has to look at: refused, its account waits to be started, or its IBAN names an account to add. */
export function waitsForPerson(statement: Pick<DryRunStatement, 'refusal' | 'start' | 'newAccount'>): boolean {
  return statement.refusal !== null || statement.start !== null || statement.newAccount !== null
}

/** The record that remembers a statement the sync just held, waiting. */
export function heldStatementOfMail(mailed: MailedStatement, iban: string): HeldStatement {
  return { ...mailed, iban, passedOverOn: null, id: recordIdOf(HELD_STATEMENT_RECORDS, newRecordId()) }
}

/** Whether the run files every row of the statement that the ledger lacks, so nothing of it waits for the person. */
export function isSettled(statement: Pick<DryRunStatement, 'refusal' | 'rows'>): boolean {
  return statement.refusal === null && statement.rows.length > 0 && statement.rows.every((row) => row.inLedger || row.verdict !== null)
}

/** Deletes the record of each statement of the run that it files or the ledger holds. */
export function forgetSettledStatements(unit: UnitOfWork, books: CompanyBooks, statements: readonly DryRunStatement[]): void {
  const settled = statements.filter(isSettled).map((statement) => ({ attachment: statement.fileName, label: statement.label }))
  for (const held of recordsOf(books.records['held-statements'])) {
    if (settled.some((statement) => isHeldStatement(held, statement))) unit.of(HELD_STATEMENT_WRITES).remove(held)
  }
}

/** Passes a held statement over on the day, so the mail search stops reaching back to it and a later sync holds it no more. */
export function passOverHeldStatement(unit: UnitOfWork, held: HeldStatement, on: CivilDate): void {
  unit.of(HELD_STATEMENT_WRITES).change(held, { ...held, passedOverOn: on })
}

/** The readings less those of statements the person passed over. */
export function notPassedOver(readings: readonly StatementReading[], held: readonly HeldStatement[]): StatementReading[] {
  const passedOver = held.filter((record) => record.passedOverOn !== null)
  return readings.filter((reading) => {
    const { fileName, label } = 'statement' in reading ? reading.statement : reading
    return !passedOver.some((record) => isHeldStatement(record, { attachment: fileName, label }))
  })
}
