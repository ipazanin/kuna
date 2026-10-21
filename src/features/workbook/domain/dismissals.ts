import type { CivilDate } from '../../../shared/calendar/civilDate'

/** The suggestions a person can dismiss: confirmed rows no rule settles, and confirmed rows a rule files in another category. */
export const SUGGESTION_KINDS = ['not-covered', 'exception'] as const

export type SuggestionKind = (typeof SUGGESTION_KINDS)[number]

/** One suggestion a person dismissed, from the `dismissed` tab. It stays dismissed as new rows join its group. */
export interface Dismissal {
  readonly kind: SuggestionKind
  /** The counterparty the suggestion groups its rows by, as counterparty filters key it, such as `name:` and the folded name. An exception adds `|` and the rule's id. */
  readonly key: string
  /** The category most of the group's rows were in when it was dismissed. */
  readonly category: string
  /** Null when the cell is blank. */
  readonly dismissedOn: CivilDate | null
  readonly sheetRow: number
}
