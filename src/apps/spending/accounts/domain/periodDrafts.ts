import type { SpendingPeriod, SpendingSource } from '../../workbook/domain/account'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** One source of an account's rows as typed: the first runs from the start day, and each later one from the day typed. */
export interface PeriodDraft {
  readonly source: SpendingSource
  readonly from: string
}

/** Why a typed period cannot be kept: it has no day, its day is not after the one above, or it repeats the source above. */
export type PeriodDraftProblem = 'day-needed' | 'after-earlier' | 'same-as-earlier'

/** The periods as the account dialog shows them. */
export function draftsOf(periods: readonly SpendingPeriod[]): readonly PeriodDraft[] {
  return periods.map((period) => ({ source: period.source, from: period.from ?? '' }))
}

/** The periods typed, with why each cannot be kept, or null for one that can, and null periods while one cannot. A later period starts after the start day and after the one above. */
export function periodsOfDrafts(
  drafts: readonly PeriodDraft[],
  start: CivilDate | null,
): { readonly periods: readonly SpendingPeriod[] | null; readonly problems: readonly (PeriodDraftProblem | null)[] } {
  const periods: SpendingPeriod[] = []
  const problems = drafts.map((draft, place): PeriodDraftProblem | null => {
    if (place === 0) {
      periods.push({ source: draft.source, from: null })
      return null
    }
    const earlier = drafts[place - 1]!
    const from = parseCivilDate(draft.from)
    if (from === null) return 'day-needed'
    const earlierFrom = place === 1 ? start : parseCivilDate(earlier.from)
    if (earlierFrom !== null && from <= earlierFrom) return 'after-earlier'
    if (earlier.source === draft.source) return 'same-as-earlier'
    periods.push({ source: draft.source, from })
    return null
  })
  return { periods: problems.every((problem) => problem === null) ? periods : null, problems }
}
