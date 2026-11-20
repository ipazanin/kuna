import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * A statement the sync read from the bank's mail and held for the person, from the `held-statements` tab. Its rows stay in the
 * mail, so the record keeps only what finds the mail again. It stays until the statement is filed, which deletes it, or passed over.
 */
export interface HeldStatement {
  /** Gmail's id of the mail it came in. */
  readonly mailId: string
  /** The name of the attachment it was read from, such as an XML file. */
  readonly attachment: string
  /** What the ledger's `statement` column would say for its rows. */
  readonly label: string
  /** Normalised, or blank when the statement names none. */
  readonly iban: string
  /** The day the mail came, which the mail search reaches back to while the statement waits. */
  readonly mailedOn: CivilDate
  /** The day the person passed it over, or null while it waits. */
  readonly passedOverOn: CivilDate | null
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

/** Which statement of which attachment a held record stands for, as a sync's readings and dry runs name them. */
export interface HeldStatementKey {
  readonly attachment: string
  readonly label: string
}

/** Whether the record stands for the statement of this file and label. */
export function isHeldStatement(held: Pick<HeldStatement, 'attachment' | 'label'>, statement: HeldStatementKey): boolean {
  return held.attachment === statement.attachment && held.label === statement.label
}

/** The held records that still wait for the person, not passed over. */
export function waitingStatements<Held extends Pick<HeldStatement, 'passedOverOn'>>(held: readonly Held[]): Held[] {
  return held.filter((statement) => statement.passedOverOn === null)
}
