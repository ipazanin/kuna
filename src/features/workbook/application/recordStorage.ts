import type { RecordId } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import type { RefusedRecord, StoredRecord } from '../domain/recordsRead'
import type { FreshRecords } from '../domain/writeRules'

/** One record a write adds, changes, repairs or removes. A changed, repaired or removed record is found by its identity. */
export type RecordChange<R = unknown> =
  | { readonly kind: RecordKind<R>; readonly verb: 'add'; readonly after: R }
  | { readonly kind: RecordKind<R>; readonly verb: 'change'; readonly before: R; readonly after: R }
  | { readonly kind: RecordKind<R>; readonly verb: 'remove'; readonly before: R }
  /** A refused record stored as a valid one. One without an identity is found by its fields. */
  | { readonly kind: RecordKind<R>; readonly verb: 'repair'; readonly refused: RefusedRecord; readonly after: R }
  /** A refused record taken out. One without an identity is found by its fields. */
  | { readonly kind: RecordKind<R>; readonly verb: 'discard'; readonly refused: RefusedRecord }

/** What a write would leave in the storage, worked out on its last read with nothing written. */
export interface StoragePreview {
  /** The kinds of the last read as the changes would leave them. */
  readonly records: FreshRecords
  /** Each change's record as the storage would hold it, null for a removal, in the order of the changes. */
  readonly written: readonly (StoredRecord<unknown> | null)[]
}

/**
 * Where records are kept, the port each storage adapter implements. One instance serves one
 * write: it reads, works out what the changes would leave on that read, then applies them there.
 */
export interface RecordStorage {
  /** What the storage holds of these kinds now. */
  read(kinds: readonly RecordKind<unknown>[]): Promise<FreshRecords>
  /** The identity the storage keeps a record by, or null when the record lacks its key or id. */
  identify<R>(kind: RecordKind<R>, record: R): RecordId | null
  /** The words that name a record for a person, such as an invoice's number. */
  labelOf<R>(kind: RecordKind<R>, record: R): string
  /**
   * What the changes would leave, with nothing written. Throws `WorkbookWriteRefused` when the
   * storage cannot hold a change, such as a field it has no place for.
   */
  preview(changes: readonly RecordChange[], addMissingKinds: boolean): StoragePreview
  /**
   * Applies every change on the last read, or none, finding each record by its identity. A change
   * writes only the fields it alters, so a field it leaves alone keeps what the storage holds.
   * `addMissingKinds`, once the person agreed, gives the storage a place for a kind it lacks, or
   * for a field of a kind it holds.
   */
  apply(changes: readonly RecordChange[], addMissingKinds: boolean): Promise<void>
}
