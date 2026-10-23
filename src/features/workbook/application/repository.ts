import type { RefusedRecord } from '../domain/recordsRead'
import type { WriteRules } from '../domain/writeRules'

/** One kind's records inside a write. Each call is checked and applied with the rest of the write, or not at all. */
export interface Repository<R> {
  add(record: R): void
  /** `before` is the record as the app read it. The write is refused when the storage holds something else. */
  change(before: R, after: R): void
  remove(record: R): void
  /** Stores a refused record as this one. A refused record without an identity is found by its fields. */
  repair(refused: RefusedRecord, after: R): void
  /** Takes a refused record out, found the same way. */
  discard(refused: RefusedRecord): void
}

/** The repositories of one write, one per kind, each checked by the kind's write rules. */
export interface UnitOfWork {
  of<R>(rules: WriteRules<R>): Repository<R>
}
