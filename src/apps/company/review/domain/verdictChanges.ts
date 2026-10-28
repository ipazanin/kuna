import { filedIn } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { categorise } from '../../rules/domain/categorise'
import type { Rule } from '../../rules/domain/rule'
import type { CategorisableTransaction, CategorisationContext } from '../../rules/domain/transactionFacts'
import type { Settings } from '../../settings/domain/settings'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Transaction } from '../../workbook/domain/workbook'

/** A ledger row's `category` and `flagged_by`, which a person or a rule decides. */
export interface LedgerVerdict {
  readonly category: string
  readonly flaggedBy: string
}

/** The verdict one ledger row is to take, the row by its id. */
export interface RowVerdict {
  readonly id: RecordId
  readonly verdict: LedgerVerdict
}

type ReviewedRow = Pick<Transaction, 'id' | 'category' | 'flaggedBy' | 'bucket'>

/** A person agrees with the category the row has: it stays, and `flagged_by` takes their review label. Null for a row whose category is not defined. */
export function confirmation(transaction: ReviewedRow, settings: Pick<Settings, 'reviewLabel'>): RowVerdict | null {
  if (transaction.bucket === UNCLASSIFIED) {
    return null
  }
  return { id: transaction.id, verdict: { category: transaction.category, flaggedBy: settings.reviewLabel } }
}

/** A person files the row in another category, which `flagged_by` records with their review label. */
export function recategorisation(transaction: ReviewedRow, category: string, settings: Pick<Settings, 'reviewLabel'>): RowVerdict {
  return { id: transaction.id, verdict: { category, flaggedBy: settings.reviewLabel } }
}

/**
 * The ledger entry with the verdict and the default share of its category, everything else as it
 * was. Every verdict copies the default again, so a confirmed row takes a default changed since it
 * was filed, and a recategorised one takes the new category's over any share it held.
 */
export function withVerdict(entry: LedgerEntry, verdict: LedgerVerdict, categories: readonly ShareDefault[]): LedgerEntry {
  return { ...filedIn(entry, verdict.category, categories), flaggedBy: verdict.flaggedBy }
}

/**
 * The rows a new rule settles that still wait on review: flagged `ai` or unclassified, never a row
 * a person confirmed. Each takes the rule's category and `rule`, as a sync or an import would have
 * written had the rule existed.
 */
export function waitingRowsSettledBy(
  ruleId: string,
  transactions: readonly (ReviewedRow & CategorisableTransaction)[],
  rules: readonly Rule[],
  context: CategorisationContext,
): RowVerdict[] {
  const verdicts: RowVerdict[] = []
  for (const transaction of transactions) {
    if (isHumanConfirmed(transaction) || (transaction.flaggedBy !== 'ai' && transaction.bucket !== UNCLASSIFIED)) {
      continue
    }
    const verdict = categorise(transaction, rules, context)
    if (verdict.ruleId?.toLowerCase() !== ruleId.toLowerCase() || verdict.flaggedBy !== 'rule') {
      continue
    }
    verdicts.push({ id: transaction.id, verdict: { category: verdict.category, flaggedBy: 'rule' } })
  }
  return verdicts
}
