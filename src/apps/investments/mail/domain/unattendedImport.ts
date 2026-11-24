import { reviewQuestions } from '../../imports/domain/importChoices'
import type { SettledImport } from '../../imports/domain/importChoices'
import { importableRecords } from '../../imports/domain/importedRecords'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

/** Why a sync leaves a mailed report for the person instead of importing it by itself. */
export type ImportWait =
  /** A file of the sync's mail does not fit the recipe, so a day's rows may be missing. */
  | { readonly kind: 'misfit' }
  /** The prices file lacks the ECB rates of these currencies, even after a fetch. */
  | { readonly kind: 'rates'; readonly currencies: readonly string[] }
  | { readonly kind: 'account' }
  /** Holdings no earlier import wrote to that no single holding with the same ISIN answers, by the symbols the rows give. */
  | { readonly kind: 'instrument'; readonly symbols: readonly string[] }
  | { readonly kind: 'split' }
  | { readonly kind: 'spin-off' }
  | { readonly kind: 'look-alike' }
  /** Rows the recipe would not guess at. */
  | { readonly kind: 'asked' }
  /** Rows that wait on a row still to come or on a figure Kuna cannot read, such as a sale beyond what is held. */
  | { readonly kind: 'waiting' }
  /** Rows the dry run cannot keep, other than an exchange of less than a cent. */
  | { readonly kind: 'skipped' }
  /** A row signed against its type, or a trade whose fees differ from its commission, which the review lists as worth a look. */
  | { readonly kind: 'worth-a-look' }
  /** Rows an import of this page put in and Undo took back. */
  | { readonly kind: 'undone' }

/** What the settled import cannot tell by itself. */
export interface UnattendedFacts {
  readonly misfit: boolean
  /** The currencies whose ECB rates the rows still need, empty when the prices file has them all. */
  readonly lackingRates: readonly string[]
  /** The import keys of rows a sync of this page imported and Undo took back. */
  readonly undone: ReadonlySet<string>
}

/**
 * Why a mailed report cannot go in without the person, empty when it may: the answers it would take are those Accept
 * takes with no click, and the review would ask nothing. A record the report now gives other figures for waits in the
 * banner without holding the rest back, since Accept leaves it as it is too.
 */
export function unattendedWaits(settled: SettledImport, book: InvestmentBook, facts: UnattendedFacts): ImportWait[] {
  const { dryRun } = settled
  const asked = reviewQuestions(settled, book)
  const added = importableRecords(dryRun.added)
  const waits: (ImportWait | null)[] = [
    facts.misfit ? { kind: 'misfit' } : null,
    facts.lackingRates.length > 0 ? { kind: 'rates', currencies: facts.lackingRates } : null,
    asked.accounts.length > 0 ? { kind: 'account' } : null,
    asked.instruments.length > 0 ? { kind: 'instrument', symbols: asked.instruments.flatMap(({ question }) => question.symbols) } : null,
    settled.splits.length > 0 ? { kind: 'split' } : null,
    settled.spinOffs.length > 0 ? { kind: 'spin-off' } : null,
    asked.lookAlikes > 0 ? { kind: 'look-alike' } : null,
    asked.asked > 0 ? { kind: 'asked' } : null,
    dryRun.entries.some((entry) => entry.outcome.kind === 'waiting' && entry.outcome.reason.kind !== 'differs-from-kuna' && entry.outcome.reason.kind !== 'looks-in-kuna') ? { kind: 'waiting' } : null,
    dryRun.skipped.some((skipped) => skipped.reason.kind !== 'below-a-cent') ? { kind: 'skipped' } : null,
    dryRun.reversals.length > 0 || dryRun.commissionDifferences.length > 0 ? { kind: 'worth-a-look' } : null,
    added.some((imported) => imported.record.importKeys.some((key) => facts.undone.has(key))) ? { kind: 'undone' } : null,
  ]
  return waits.filter((wait) => wait !== null)
}
