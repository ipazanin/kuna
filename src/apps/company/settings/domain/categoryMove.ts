import { movedTo } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import type { RuleTabRow } from '../../rules/domain/readRules'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import { cellText } from '../../../../shared/text/cellText'

/** One record a move changes, as read and as it is written. */
export interface MovedRecord<R> {
  readonly before: R
  readonly after: R
}

/** What deleting a category into another changes besides the category itself. */
export interface CategoryMove {
  readonly ledger: readonly MovedRecord<LedgerEntry>[]
  readonly splits: readonly MovedRecord<SplitTabRow>[]
  readonly rules: readonly MovedRecord<RuleTabRow>[]
}

/**
 * The ledger rows and split parts filed in `category`, each moved into `into` with that category's default share, and the rules that
 * file into it, each filing into `into`. A row keeps who filed it, so a row a person confirmed stays confirmed.
 */
export function categoryMove(
  category: string,
  into: string,
  records: { readonly ledger: readonly LedgerEntry[]; readonly splits: readonly SplitTabRow[]; readonly rules: readonly RuleTabRow[] },
  categories: readonly ShareDefault[],
): CategoryMove {
  const filedIn = (record: { readonly category: string }) => record.category.toLowerCase() === category
  return {
    ledger: records.ledger.filter(filedIn).map((entry) => ({ before: entry, after: movedTo(entry, into, categories) })),
    splits: records.splits.filter(filedIn).map((part) => ({ before: part, after: movedTo(part, into, categories) })),
    rules: records.rules.filter((rule) => cellText(rule.fields.category).trim().toLowerCase() === category).map((rule) => ({ before: rule, after: { fields: { ...rule.fields, category: into } } })),
  }
}
