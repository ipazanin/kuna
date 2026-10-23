import type { PackSettings } from '../../settings/domain/settings'
import type { RecordId } from './recordId'
import type { RecordKind } from './recordKind'
import { NO_RECORDS } from './recordsRead'
import type { RecordsRead } from './recordsRead'
import type { OwnerAdvance, Workbook, WorkbookProblem } from './workbook'
import type { WriteRules } from './writeRules'

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

/**
 * How a pack makes its part of the workbook: the settings keys it reads, which core leaves to it,
 * and the part made from its records once core's records are read.
 */
export interface PackPart<Part, Values> {
  readonly key: PackKey<Part>
  /** The pack's kinds, each with how its records are written. */
  readonly kinds: readonly WriteRules<unknown>[]
  readonly settings: PackSettings<Values>
  /** The part, from the pack's records, the values its settings keys hold and core's workbook, with the problems of its records and its keys. */
  assemble(records: PackRecords, values: Values, core: Workbook): { readonly part: Part; readonly problems: readonly WorkbookProblem[] }
  /** The costs the owner paid privately that the part holds, which profit and loss, Transactions and the filters count beside the bank rows. */
  ownerAdvances(part: Part): readonly OwnerAdvance[]
  /** The ledger rows the pack keeps whole, by their record id, with the names that claim them. Applies whatever the owner-pay switch says. */
  rowsKeptWhole(records: PackRecords, ledger: Pick<Workbook, 'transactions' | 'categories'>): ReadonlyMap<RecordId, readonly string[]>
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
