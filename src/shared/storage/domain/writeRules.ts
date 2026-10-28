import type { RecordId } from './recordId'
import type { RecordKind } from './recordKind'
import type { Reading, RecordsRead, StoredRecord } from './recordsRead'
import type { StoredFields } from './storedFields'

/** What a storage holds of the kinds one write read, as it read them just now. */
export interface FreshRecords {
  /** The records of the kind, none when the storage lacks the kind or it was not read. */
  of<R>(kind: RecordKind<R>): RecordsRead<R>
}

/** One record a write touches: as stored now, null for an add, and as it will be stored, null for a remove. */
export interface RecordEdit<R> {
  readonly before: StoredRecord<R> | null
  readonly after: StoredRecord<R> | null
}

/** What one write does to one kind, as that kind's checks see it. */
export interface KindChange<R> {
  /** Every record the write adds, changes, repairs or removes, in the order the write gives them. */
  readonly edits: readonly RecordEdit<R>[]
  /** The records of the kind the write leaves alone. */
  readonly untouched: readonly StoredRecord<R>[]
  /** The kind as stored now. */
  readonly before: RecordsRead<R>
  /** The kind as it will be stored once the write is made. */
  readonly after: RecordsRead<R>
  /** True when the write puts back what an earlier write of the session did. */
  readonly undoing: boolean
}

/**
 * How one kind's records are written: which other kinds its checks read, what keeps the workbook
 * and what reads it valid, and whether a write of it can be undone. Storage terms such as tabs,
 * columns and cells stay with the storage.
 */
export interface WriteRules<R> {
  readonly kind: RecordKind<R>
  /** Kinds whose fresh records the reader and the checks need, such as categories for a verdict. */
  readonly reads: readonly RecordKind<unknown>[]
  /** The names of the record's fields a change may touch. Unset means all. */
  readonly changeable?: readonly string[]
  /** False for settings, which keep no Undo. */
  readonly undoable: boolean
  /** The kind's own reader against the other kinds as given: which records count, and why the rest do not or are doubted. */
  read(read: RecordsRead<R>, records: FreshRecords): Reading<{ readonly id: RecordId }>
  /** Why the change would break the workbook or what reads it, each a sentence. Empty when it may go ahead. */
  refusals(change: KindChange<R>, fresh: FreshRecords): readonly string[]
}

/** Each record the change touches as the kind's checks take it, picked from its stored fields: before, null for an add, and after, null for a remove. */
export function pickedEdits<R, Picked>(change: KindChange<R>, pick: (fields: StoredFields) => Picked): { readonly before: Picked | null; readonly after: Picked | null }[] {
  return change.edits.map((edit) => ({ before: edit.before === null ? null : pick(edit.before.fields), after: edit.after === null ? null : pick(edit.after.fields) }))
}

/** The records the change leaves alone, picked from their stored fields. */
export function pickedUntouched<R, Picked>(change: KindChange<R>, pick: (fields: StoredFields) => Picked): Picked[] {
  return change.untouched.map((stored) => pick(stored.fields))
}
