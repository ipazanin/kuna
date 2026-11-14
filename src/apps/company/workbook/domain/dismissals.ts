import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * The suggestions a person can dismiss: confirmed rows no rule settles, confirmed rows a rule files in another category, and
 * a category the pack suggests the tax class new books give it.
 */
export const SUGGESTION_KINDS = ['not-covered', 'exception', 'newer-class'] as const

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number]

/** The suggestions of Settings, Category rules, which group confirmed rows by their counterparty. */
export type CoverageKind = Exclude<SuggestionKind, 'newer-class'>

/** One suggestion a person dismissed, from the `dismissed` tab. It stays dismissed as new rows join its group. */
export interface Dismissal {
  readonly kind: SuggestionKind
  /**
   * The counterparty the suggestion groups its rows by, as counterparty filters key it, such as `name:` and the folded name. An exception adds `|` and the rule's id.
   * A newer class names the category's short name.
   */
  readonly key: string
  /** The category most of the group's rows were in when it was dismissed, or for a newer class the category itself. */
  readonly category: string
  /** Null when the cell is blank. */
  readonly dismissedOn: CivilDate | null
  /** Held by no other row of its tab. */
  readonly id: RecordId
}

/** Whether the person dismissed the class the pack suggests for the category with this short name. */
export function newerClassDismissed(dismissals: readonly Dismissal[], category: string): boolean {
  return dismissals.some((dismissal) => dismissal.kind === 'newer-class' && dismissal.key === category)
}
