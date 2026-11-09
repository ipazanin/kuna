import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Rule } from '../../../../shared/categorising/domain/rule'
import type { PackSettings } from '../../settings/domain/settings'
import type { PairSides } from '../../transactions/domain/pairSides'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { DefinedBucket } from './bucket'
import type { VatTreatment } from './vatTreatment'
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
  /** How a refusal counts the records, such as "3 owner advances". */
  readonly counted: (count: number) => string
  /** The categories a record names, from its fields as stored, refused records included. */
  categoriesOf(fields: StoredFields): readonly string[]
}

/** A way a pack counts a category, which the category takes by carrying its role, with the VAT treatments and buckets it allows. */
export interface CategoryClass {
  readonly role: string
  readonly vat: readonly VatTreatment[]
  readonly buckets: readonly DefinedBucket[]
  /** Roles an earlier version of the pack gave this class, which picking the class takes off the category. */
  readonly replaces?: readonly string[]
}

/** A category new books start with, as its row on the categories tab holds it. */
export interface StartingCategory {
  readonly slug: string
  readonly family: string
  readonly bucket: DefinedBucket
  /** As the tab stores it. A colour outside the palette draws in the bucket's colour. */
  readonly colour: string
  readonly roles: readonly string[]
  readonly vat: VatTreatment
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
  /** The classes a category carries one of, each by one of `categoryRoles`. None means categories need no class. */
  readonly categoryClasses: readonly CategoryClass[]
  /** The roles of categories that come in a credit and a debit pair, such as a loan out and its repayment, whose proposed rules go by direction. */
  readonly directionPairedRoles: readonly string[]
  /** The side each of the pack's paired roles takes, where a reimbursement has none since it goes either way. */
  readonly pairSides: PairSides
  /** The categories new books start with. */
  readonly startingCategories: readonly StartingCategory[]
  /** The category rules new books made on the day start with. */
  startingRules(on: CivilDate): readonly Rule[]
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
