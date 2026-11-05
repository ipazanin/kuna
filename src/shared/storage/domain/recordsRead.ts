import type { RecordId } from './recordId'
import type { StoredFields } from './storedFields'
import { sharedKeys } from './sharedKeys'
import { words } from './words'

/** Where the workbook document is kept: a file on Google Drive, or this browser. */
export type WorkbookSource = 'drive' | 'browser'

/** A stored record the kind's factory could make, with what names it and its fields as stored, so an editor shows what the storage holds. */
export interface ReadRecord<R> {
  readonly record: R
  /** Null for a kind whose records may lack their key, such as a settings row without a key. */
  readonly id: RecordId | null
  readonly label: string
  readonly fields: StoredFields
}

/** A stored record the domain refuses, kept so an editor can show it and fix it. */
export interface RefusedRecord {
  /** Null when the record lacks its key or id. */
  readonly id: RecordId | null
  readonly label: string
  readonly fields: StoredFields
  readonly reason: string
}

/** What a storage holds of one kind, in the order it gives them: the records the kind's factory makes, and the ones it refuses. */
export interface RecordsRead<R> {
  readonly records: readonly ReadRecord<R>[]
  readonly refused: readonly RefusedRecord[]
}

/** A stored record, made by its kind's factory or refused by it. */
export type StoredRecord<R> = ReadRecord<R> | RefusedRecord

/** Every stored record of a read, refused ones after the rest. */
export function storedOf<R>(read: RecordsRead<R>): StoredRecord<R>[] {
  return [...read.records, ...read.refused]
}

/** Why a stored record was left out or is doubted, with what names it for a person. */
export interface RecordProblem {
  /** Null when the record lacks its key or id. */
  readonly id: RecordId | null
  /** Such as an invoice's number or an asset's name. */
  readonly label: string
  readonly reason: string
}

/** The records of one kind the workbook counts, and why the rest were left out or are doubted. */
export interface Reading<R> {
  readonly facts: readonly R[]
  readonly problems: readonly RecordProblem[]
}

/** What a storage without any record of a kind holds of it. */
export const NO_RECORDS: RecordsRead<never> = { records: [], refused: [] }

const READING_LOOKUPS = new WeakMap<Reading<{ readonly id: RecordId }>, { readonly kept: ReadonlySet<RecordId>; readonly problems: ReadonlyMap<RecordId | null, readonly RecordProblem[]> }>()

/** A reading's kept ids and its problems by id, worked out once, since a check asks after every record of a kind on each write. */
export function readingLookup(reading: Reading<{ readonly id: RecordId }>): { readonly kept: ReadonlySet<RecordId>; readonly problems: ReadonlyMap<RecordId | null, readonly RecordProblem[]> } {
  const held = READING_LOOKUPS.get(reading)
  if (held !== undefined) return held
  const problems = new Map<RecordId | null, RecordProblem[]>()
  for (const problem of reading.problems) problems.set(problem.id, [...(problems.get(problem.id) ?? []), problem])
  const lookup = { kept: new Set(reading.facts.map((fact) => fact.id)), problems }
  READING_LOOKUPS.set(reading, lookup)
  return lookup
}

/** A problem on a stored record, named as the storage names it. */
export function problemOf(stored: Pick<RefusedRecord, 'id' | 'label'>, reason: string): RecordProblem {
  return { id: stored.id, label: stored.label, reason }
}

/** The records the kind's factory made, in the order the storage gives them. */
export function recordsOf<R>(read: RecordsRead<R>): R[] {
  return read.records.map((stored) => stored.record)
}

/** The record with this id as the app read it, with its stored fields, or null when no record or several hold the id, or the one holding it was refused. */
export function recordWithId<R>(read: RecordsRead<R>, id: RecordId): ReadRecord<R> | null {
  const holding = storedOf(read).filter((stored) => stored.id === id)
  const [only] = holding
  return holding.length === 1 && only !== undefined && 'record' in only ? only : null
}

/** Why each refused record was refused. */
export function refusedProblems(read: RecordsRead<unknown>): RecordProblem[] {
  return read.refused.map((refused) => problemOf(refused, refused.reason))
}

/** Every stored record of a read, refused ones too, as their fields. */
export function storedFieldsOf(read: RecordsRead<unknown>): StoredFields[] {
  return storedOf(read).map((stored) => stored.fields)
}

/**
 * Whether another stored record of a kind without a business key holds this record's id too, as a
 * copied row does. The ids of refused records count, since a copy is refused alongside its original.
 */
export function idSharing(read: RecordsRead<unknown>): (stored: ReadRecord<unknown>) => boolean {
  const shared = sharedKeys(
    storedOf(read).flatMap((stored) => (stored.id === null ? [] : [stored.id])),
    (id) => id,
  )
  return (stored) => stored.id !== null && shared.has(stored.id)
}

export const SHARED_ID_REASON = words.reasons.sharedId

/** The records the reasons leave in, the rest as problems, after the problems of records the factory refused and of ids two records share. */
export function readEach<R>(read: RecordsRead<R>, reasonsOf: (stored: ReadRecord<R>) => readonly string[]): Reading<R> {
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

/** Whether two records hold the same values, field for field and item for item, a missing field as an undefined one. */
export function sameRecord(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true
  }
  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null || Array.isArray(left) !== Array.isArray(right)) {
    return false
  }
  const fields = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...fields].every((field) => sameRecord((left as Readonly<Record<string, unknown>>)[field], (right as Readonly<Record<string, unknown>>)[field]))
}
