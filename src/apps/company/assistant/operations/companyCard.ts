import type { CompanyBooks, WorkbookRecords } from '../../workbook/domain/readWorkbook'
import type { Category, Transaction, Workbook } from '../../workbook/domain/workbook'
import type { AssistantOperation, CardNote, ProposalStep } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { OpenBooks } from '../../../../shared/app/proposedWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What one step of a Company card plans with: the books as read, the books as the card's earlier steps left them, and the write. */
export interface CompanyCard {
  /** The books as read when the card was checked. */
  readonly books: OpenBooks<CompanyBooks>
  /** The workbook as the card's earlier steps left it, so a step sees what an earlier one made. */
  readonly workbook: Workbook
  /** The write, which adds up the steps' changes, one change for each record. */
  readonly unit: UnitOfWork
  /** The records as read, with what the card's earlier steps wrote. */
  records(): WorkbookRecords
  /** The id a step's field names: a ref Kuna handed out, or a `$` name of an earlier step. */
  idOf(value: unknown): string
  /** Names what a step made, so a later step may use its `$` name. */
  made(as: string | null, id: string): void
  /** Shows a note on the card beside what the write does, such as a confirmed row a rule now disagrees with. */
  note(note: CardNote): void
}

/** A part of what the chat can do in Company, in its own file: its operations, and how it plans a step of one of them. */
export interface CompanyOperationSet {
  readonly operations: readonly AssistantOperation[]
  planStep(card: CompanyCard, step: ProposalStep): void
  /** Checks what the card's steps add up to, after the last step, as a screen checks a form across its fields. */
  finish?(card: CompanyCard): void
}

/** The ledger row a field names. */
export function rowOf(card: CompanyCard, value: unknown): Transaction {
  const id = card.idOf(value)
  const row = card.workbook.transactions.find((candidate) => candidate.id === id)
  if (row === undefined) throw new StepRefused('That ledger row is no longer in the books.')
  return row
}

/** The category a field names by its short name. */
export function categoryOf(card: CompanyCard, value: unknown): Category {
  const slug = card.idOf(value).toLowerCase()
  const category = card.workbook.categories.find((candidate) => candidate.slug === slug)
  if (category === undefined) throw new StepRefused('That category is no longer in the books.')
  return category
}

/** A step's input, which the chat checked against the operation's schema, so each field has the type the schema gives it. */
export function fieldsOf(step: ProposalStep): Readonly<Record<string, never>> {
  return step.input as Readonly<Record<string, never>>
}

/** "yes" or "no" as a flag, or null to leave it. */
export function flagOf(text: string | null): boolean | null {
  return text === null ? null : text === 'yes'
}
