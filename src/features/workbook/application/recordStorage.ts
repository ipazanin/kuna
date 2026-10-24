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

/** What a write's checks need of a storage: a read, a record's identity and words, and what changes would leave on that read. */
export interface StorageView {
  /** What the storage holds of these kinds now. */
  read(kinds: readonly RecordKind<unknown>[]): Promise<FreshRecords>
  /** The identity the storage keeps a record by, or null when the record lacks its key or id. */
  identify<R>(kind: RecordKind<R>, record: R): RecordId | null
  /** The words that name a record for a person, such as an invoice's number. */
  labelOf<R>(kind: RecordKind<R>, record: R): string
  /**
   * What the changes would leave, with nothing written. Throws `WorkbookWriteRefused` when the
   * storage cannot hold the changes, such as a file a newer app saved.
   */
  preview(changes: readonly RecordChange[]): StoragePreview
}

/**
 * Where records are kept, the port each storage adapter implements. One instance serves one
 * write: it reads, works out what the changes would leave on that read, then applies them there.
 */
export interface RecordStorage extends StorageView {
  /**
   * Applies every change on the last read, or none, finding each record by its identity. A change
   * writes only the fields it alters, so a field it leaves alone keeps what the storage holds.
   * Answers `moved` when the storage changed since the read and nothing was written. When another
   * device's save landed at the same moment, `recheck` runs the write's checks on that save and
   * throws `WorkbookWriteRefused` when the write no longer holds there.
   */
  apply(changes: readonly RecordChange[], recheck: (storage: StorageView) => Promise<void>): Promise<'applied' | 'moved'>
}
