import type { LoanChange, LoanScenario, ScenarioChange } from '../domain/loanScenario'
import { bookWith, dependentRefusals } from '../../workbook/application/loanWriteGuards'
import { BANK_LOAN_RECORDS, LOAN_SCENARIO_RECORDS, SCENARIO_CHANGE_RECORDS } from '../../workbook/domain/loanKinds'
import type { LoansRecords, ScenarioBook } from '../../workbook/domain/readLoanBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** The kinds a scenario's reading reads: the bank loan it names, the scenarios, and the changes that name them. */
const SCENARIO_KINDS = [BANK_LOAN_RECORDS, LOAN_SCENARIO_RECORDS, SCENARIO_CHANGE_RECORDS]

/** A scenario keeps the changes that name it. */
export const LOAN_SCENARIO_WRITES: WriteRules<LoanScenario> = {
  kind: LOAN_SCENARIO_RECORDS,
  reads: SCENARIO_KINDS,
  undoable: true,
  read: (read, records) => bookWith(LOAN_SCENARIO_RECORDS, read, records).readings.loanScenarios,
  refusals: (_change, fresh, after) => dependentRefusals(['scenarioChanges'], fresh, after),
}

/** A change keeps its scenario's other changes counting, so a second move is refused. */
export const SCENARIO_CHANGE_WRITES: WriteRules<ScenarioChange> = {
  kind: SCENARIO_CHANGE_RECORDS,
  reads: SCENARIO_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SCENARIO_CHANGE_RECORDS, read, records).readings.scenarioChanges,
  refusals: (_change, fresh, after) => dependentRefusals(['scenarioChanges'], fresh, after),
}

export function newLoanScenario(scenario: Omit<LoanScenario, 'id'>): LoanScenario {
  return { ...scenario, name: scenario.name.trim(), id: recordIdOf(LOAN_SCENARIO_RECORDS, newRecordId()) }
}

/** The change under an id of its own, naming the scenario, whatever id and scenario it held. */
function newScenarioChange(scenario: LoanScenario, change: LoanChange): ScenarioChange {
  return { ...change, id: recordIdOf(SCENARIO_CHANGE_RECORDS, newRecordId()), scenario: scenario.id }
}

function changesOf(records: LoansRecords, scenario: LoanScenario): ScenarioChange[] {
  return records.scenarioChanges.records.filter((stored) => stored.record.scenario === scenario.id).map((stored) => stored.record)
}

/** Writes the scenario, added or in place of the one it was, with these changes in place of its old ones, in one write so one Undo puts it back. */
export function saveScenario(unit: UnitOfWork, records: LoansRecords, scenario: LoanScenario, changes: readonly LoanChange[], editing: LoanScenario | null): void {
  if (editing === null) {
    unit.of(LOAN_SCENARIO_WRITES).add(scenario)
  } else {
    unit.of(LOAN_SCENARIO_WRITES).change(editing, scenario)
    changesOf(records, editing).forEach((change) => unit.of(SCENARIO_CHANGE_WRITES).remove(change))
  }
  changes.forEach((change) => unit.of(SCENARIO_CHANGE_WRITES).add(newScenarioChange(scenario, change)))
}

/** A new scenario under the name, with copies of the scenario's changes. */
export function copyScenario(unit: UnitOfWork, book: ScenarioBook, name: string): LoanScenario {
  const copy = newLoanScenario({ name, start: book.scenario.start })
  unit.of(LOAN_SCENARIO_WRITES).add(copy)
  book.changes.forEach((change) => unit.of(SCENARIO_CHANGE_WRITES).add(newScenarioChange(copy, change)))
  return copy
}

/** Deletes the scenario and its changes in one write. */
export function removeScenario(unit: UnitOfWork, records: LoansRecords, scenario: LoanScenario): void {
  unit.of(LOAN_SCENARIO_WRITES).remove(scenario)
  changesOf(records, scenario).forEach((change) => unit.of(SCENARIO_CHANGE_WRITES).remove(change))
}
