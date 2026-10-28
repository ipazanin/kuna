import type { PackSettings } from '../../settings/domain/settings'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { OwnerAdvance, Workbook, WorkbookProblem } from './workbook'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** Names a pack's part of the workbook and its type, as Vue's InjectionKey does. */
export interface PackKey<Part> {
  readonly name: string
  readonly __part?: Part
}

/** What a storage holds of a pack's kinds, by the kind's name. */
export type PackRecords = ReadonlyMap<string, RecordsRead<unknown>>

/** The records a storage holds of one of a pack's kinds, none when it holds none. */
export function recordsOfKind<R>(records: PackRecords, kind: RecordKind<R>): RecordsRead<R> {
  return (records.get(kind.name) ?? NO_RECORDS) as RecordsRead<R>
}

/** A kind of a pack whose records name categories, so a category they name keeps its name and its row. */
export interface CategoryNaming {
  readonly kind: RecordKind<unknown>
  /** What one record and several are called in a refusal, such as "owner advance" and "owner advances". */
  readonly one: string
  readonly many: string
  /** The categories a record names, from its fields as stored, refused records included. */
  categoriesOf(fields: StoredFields): readonly string[]
}

/**
 * How a pack makes its part of the workbook: the settings keys it reads, which core leaves to it,
 * and the part made from its records once core's records are read.
 */
export interface PackPart<Part, Values> {
  readonly key: PackKey<Part>
  /** The pack's kinds, each with how its records are written. */
  readonly kinds: readonly WriteRules<unknown>[]
  /** How each of the pack's kinds is stored. */
  readonly codecs: readonly RecordCodec<unknown>[]
  /** The version of the shape the pack stores its records in. A file saved at a higher one is read and never written. */
  readonly schemaVersion: number
  readonly settings: PackSettings<Values>
  /** The pack's kinds whose records name categories. */
  readonly categoryNaming: readonly CategoryNaming[]
  /** Which of them holds the costs the owner paid privately, whose categories stay in a bucket an advance counts in. */
  readonly ownerAdvanceNaming: CategoryNaming
  /** The roles the pack picks categories by, as the `roles` column spells them. */
  readonly categoryRoles: readonly string[]
  /** The part, from the pack's records, the values its settings keys hold and core's workbook, with the problems of its records and its keys. */
  assemble(records: PackRecords, values: Values, core: Workbook): { readonly part: Part; readonly problems: readonly WorkbookProblem[] }
  /** The costs the owner paid privately that the part holds, which profit and loss, Transactions and the filters count beside the bank rows. */
  ownerAdvances(part: Part): readonly OwnerAdvance[]
  /**
   * The ledger rows the pack keeps whole, by their record id, each with why as a clause that follows
   * "since", such as `the asset "Desk" claims it as payment`. Applies whatever the owner-pay switch says.
   */
  rowsKeptWhole(records: PackRecords, ledger: Pick<Workbook, 'transactions' | 'categories'>): ReadonlyMap<RecordId, string>
  /** The pack's kinds `rowsKeptWhole` reads, which a write that splits a ledger row reads too. */
  readonly keptWholeReads: readonly RecordKind<unknown>[]
}

/** The records of these kinds as a pack part takes them, by the kind's name. */
export function packRecordsOf(kinds: readonly RecordKind<unknown>[], of: (kind: RecordKind<unknown>) => RecordsRead<unknown>): PackRecords {
  return new Map(kinds.map((kind) => [kind.name, of(kind)]))
}

/** The pack's part of the workbook, or null when no pack with the key was installed when it was read. */
export function packPart<Part>(workbook: Pick<Workbook, 'packParts'>, key: PackKey<Part>): Part | null {
  return (workbook.packParts[key.name] as Part | undefined) ?? null
}
