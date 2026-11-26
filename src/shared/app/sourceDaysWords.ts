import type { GivenDays, HandedDays, PeriodSource } from './accountSource'
import { words } from './words'
import type { CivilDate } from '../calendar/civilDate'
import { dayInTextLabel, dayRunInText } from '../calendar/dayLabel'

/** What an app calls each of its sources in its words. */
export type SourceNames<S extends PeriodSource> = Readonly<Record<S, string>>

/** The days of a run as a sentence opens with them. `from` null is the account's start, and `to` null runs on. */
function daysInWords(from: CivilDate | null, to: CivilDate | null): string {
  if (from === null) return to === null ? words.sourceDays.always : words.sourceDays.upTo(dayInTextLabel(to))
  return to === null ? words.sourceDays.onwards(dayInTextLabel(from)) : dayRunInText({ from, to })
}

/** The line for a run of days that a change gives from one source to another: "1–14 Mar 2026: “By hand” gives way to “Statement file”." */
export function handedDaysLine<S extends PeriodSource>(run: HandedDays<S>, names: SourceNames<S>): string {
  return words.sourceDays.handed(daysInWords(run.from, run.to), names[run.before], names[run.after])
}

/** The line for a run of days that took no row before a change and a source now fills. */
export function givenDaysLine<S extends PeriodSource>(run: GivenDays<S>, names: SourceNames<S>): string {
  return words.sourceDays.given(daysInWords(run.from, run.to), names[run.after])
}
