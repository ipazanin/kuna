import { movedTo } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import type { RuleTabRow } from '../../rules/domain/readRules'
import type { CategoryNaming, EditedOn, NamedRecordsMove } from '../../workbook/domain/packPart'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import { countsBy } from '../../workbook/domain/slug'
import { cellText } from '../../../../shared/text/cellText'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** One record a move changes, as read and as it is written. */
export interface MovedRecord<R> {
  readonly before: R
  readonly after: R
}

/** The records of one of a pack's kinds that name categories, as read. */
export interface PackNamedRecords {
  readonly naming: CategoryNaming
  readonly records: RecordsRead<unknown>
}

/** What a move does to one of a pack's kinds, with the rules its records are written by. */
export interface PackRecordsMove extends NamedRecordsMove<unknown> {
  readonly writes: WriteRules<unknown>
}

/** What deleting a category into another changes besides the category itself. */
export interface CategoryMove {
  readonly ledger: readonly MovedRecord<LedgerEntry>[]
  readonly splits: readonly MovedRecord<SplitTabRow>[]
  readonly rules: readonly MovedRecord<RuleTabRow>[]
  readonly packs: readonly PackRecordsMove[]
}

/** How many records of one of a pack's kinds a move cannot rewrite still name a category, with the screen where a person fixes them. */
export interface KeptByMove {
  readonly kind: RecordKind<unknown>
  readonly count: number
  readonly editedOn: EditedOn
}

/**
 * The ledger rows and split parts filed in `category`, each moved into `into` with that category's default share, the rules that
 * file into it, each filing into `into`, and the pack's records that name it, each moved as its kind says. A row keeps who filed
 * it, so a row a person confirmed stays confirmed.
 */
export function categoryMove(
  category: string,
  into: string,
  records: { readonly ledger: readonly LedgerEntry[]; readonly splits: readonly SplitTabRow[]; readonly rules: readonly RuleTabRow[]; readonly packs: readonly PackNamedRecords[] },
  categories: readonly ShareDefault[],
): CategoryMove {
  const filedIn = (record: { readonly category: string }) => record.category.toLowerCase() === category
  return {
    ledger: records.ledger.filter(filedIn).map((entry) => ({ before: entry, after: movedTo(entry, into, categories) })),
    splits: records.splits.filter(filedIn).map((part) => ({ before: part, after: movedTo(part, into, categories) })),
    rules: records.rules.filter((rule) => cellText(rule.fields.category).trim().toLowerCase() === category).map((rule) => ({ before: rule, after: { fields: { ...rule.fields, category: into } } })),
    packs: records.packs.map(({ naming, records: read }) => ({ writes: naming.writes, ...naming.movedInto(read, category, into, categories) })),
  }
}

/** What a move leaves naming each category: the pack's records their kind refuses, which only their own screen can fix. */
export function keptByMove(packs: readonly PackNamedRecords[]): ReadonlyMap<string, readonly KeptByMove[]> {
  const kept = new Map<string, KeptByMove[]>()
  for (const { naming, records } of packs) {
    for (const [slug, count] of countsBy(records.refused, (refused) => naming.categoriesOf(refused.fields))) {
      kept.set(slug, [...(kept.get(slug) ?? []), { kind: naming.writes.kind, count, editedOn: naming.editedOn }])
    }
  }
  return kept
}
