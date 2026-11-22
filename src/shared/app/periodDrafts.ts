import type { PeriodSource, SourcePeriod } from './accountSource'
import { parseCivilDate } from '../calendar/civilDate'

/** One source of an account's rows as typed, from the day typed. The first may be left blank, which runs from the account's start. */
export interface PeriodDraft<S extends PeriodSource = PeriodSource> {
  readonly source: S
  readonly from: string
}

/** Why a typed period cannot be kept: it needs a day, its day is no date, its day is not after the one above, or it repeats the source above. */
export type PeriodDraftProblem = 'day-needed' | 'not-a-day' | 'after-earlier' | 'same-as-earlier'

/** The periods as an editor shows them. */
export function draftsOfPeriods<S extends PeriodSource>(periods: readonly SourcePeriod<S>[]): readonly PeriodDraft<S>[] {
  return periods.map((period) => ({ source: period.source, from: period.from ?? '' }))
}

/**
 * The periods typed for an account whose first period may start on a day of its own, with why each cannot be kept, or null for one
 * that can, and null periods while one cannot. A first period of a source in `dated` needs its day, as an automation's search starts on it.
 */
export function periodsOfDrafts<S extends PeriodSource>(
  drafts: readonly PeriodDraft<S>[],
  dated: readonly S[],
): { readonly periods: readonly SourcePeriod<S>[] | null; readonly problems: readonly (PeriodDraftProblem | null)[] } {
  const periods: SourcePeriod<S>[] = []
  const problems = drafts.map((draft, place): PeriodDraftProblem | null => {
    const text = draft.from.trim()
    const from = parseCivilDate(text)
    if (text !== '' && from === null) return 'not-a-day'
    if (from === null && (place > 0 || dated.includes(draft.source))) return 'day-needed'
    const earlier = periods[periods.length - 1]
    if (place > 0 && earlier !== undefined) {
      if (earlier.from !== null && from !== null && from <= earlier.from) return 'after-earlier'
      if (earlier.source === draft.source) return 'same-as-earlier'
    }
    periods.push({ source: draft.source, from })
    return null
  })
  return { periods: problems.every((problem) => problem === null) ? periods : null, problems }
}
