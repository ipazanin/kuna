import { addDays } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'

/**
 * The one way an account's rows come in, chosen when it is added: a bank link fetches them, mail brings a provider's reports,
 * and by hand covers typing, the chat and files. Each app offers the ones it has.
 */
export const ACCOUNT_SOURCES = ['bank-link', 'mail', 'by-hand'] as const

export type AccountSource = (typeof ACCOUNT_SOURCES)[number]

export type AutomatedSource = Exclude<AccountSource, 'by-hand'>

/**
 * Where a new row comes from: the account's automation, the provider's own file a person brings, such as a bank's statement
 * export or a broker's report, or by hand, which is typing, the chat's copying and any other file.
 */
export type RowOrigin = 'automation' | 'provider-file' | 'by-hand'

/** The origins besides its automation that a person may let an automated account take rows from. */
export const EXTRA_ORIGINS = ['provider-file'] as const satisfies readonly RowOrigin[]

export type ExtraOrigin = (typeof EXTRA_ORIGINS)[number]

/**
 * Whether a new row of the origin may go on the account. An account kept by hand takes rows from anywhere. An automated one
 * takes its automation's rows on every day, and another origin's only when the person allowed that origin on it.
 */
export function takesRowFrom(rowsFrom: AccountSource, alsoFrom: readonly ExtraOrigin[], origin: RowOrigin): boolean {
  return rowsFrom === 'by-hand' || origin === 'automation' || alsoFrom.some((allowed) => allowed === origin)
}

/**
 * How an account's rows come in: from its automation from its start day, with the other origins the person allows on it, or
 * by hand with no start day.
 */
export type AccountIntake<S extends AutomatedSource> =
  { readonly rowsFrom: S; readonly startsOn: CivilDate; readonly alsoFrom: readonly ExtraOrigin[] } | { readonly rowsFrom: 'by-hand'; readonly startsOn: null }

export const BY_HAND = { rowsFrom: 'by-hand', startsOn: null } as const

/** The origins besides its automation the account takes rows from. None on an account kept by hand, which takes them all. */
export function alsoFromOf(intake: AccountIntake<AutomatedSource>): readonly ExtraOrigin[] {
  return intake.rowsFrom === 'by-hand' ? [] : intake.alsoFrom
}

/** Why an account may not take its rows from its automation from a start day: the day is already filed, or rows by hand sit on the days it gives the automation. */
export type StartDayRefusal =
  { readonly kind: 'filed'; readonly startsOn: CivilDate; readonly firstOpen: CivilDate } | { readonly kind: 'rows-by-hand'; readonly count: number; readonly startsOn: CivilDate }

/**
 * Why the account's new intake may not be written, or null when it may. Only a change that gives the automation days it did
 * not have is checked, since a later start day or a switch to by hand brings no row in. Such a start day may not come before
 * `firstOpen`, the first day not yet filed, whose figures the new rows would change, and no row by hand may sit on the days it
 * gives the automation. `handDays` holds the day of each row by hand on the account. Rows by hand before the start day stay.
 */
export function startDayRefusal<S extends AutomatedSource>(
  before: AccountIntake<S> | null,
  after: AccountIntake<S>,
  handDays: readonly CivilDate[],
  firstOpen: CivilDate | null,
): StartDayRefusal | null {
  const { startsOn } = after
  if (startsOn === null) return null
  if (before !== null && before.startsOn !== null && before.rowsFrom === after.rowsFrom && startsOn >= before.startsOn) return null
  if (firstOpen !== null && startsOn < firstOpen) return { kind: 'filed', startsOn, firstOpen }
  const count = handDays.filter((day) => day >= startsOn).length
  return count === 0 ? null : { kind: 'rows-by-hand', count, startsOn }
}

/** The start day proposed when an account comes to take its rows from its automation: the day after its last row by hand, or today when it has none, and never before `firstOpen`. */
export function proposedStartDay(handDays: readonly CivilDate[], today: CivilDate, firstOpen: CivilDate | null): CivilDate {
  const after =
    handDays.length === 0
      ? today
      : addDays(
          handDays.reduce((last, day) => (day > last ? day : last)),
          1,
        )
  return firstOpen !== null && after < firstOpen ? firstOpen : after
}

/** The earliest start day of the accounts an automation fills, where its search starts, or null while it fills none. */
export function earliestStartDay(intakes: Iterable<AccountIntake<AutomatedSource>>): CivilDate | null {
  const days = [...intakes].flatMap((intake) => (intake.rowsFrom === 'by-hand' ? [] : [intake.startsOn]))
  return days.length === 0 ? null : days.reduce((first, day) => (day < first ? day : first))
}

/** Where a period's rows come from: the account's automation, the provider's own file, or by hand. Each app offers the ones it has. */
export type PeriodSource = 'bank-link' | 'mail' | 'provider-file' | 'by-hand'

/**
 * From this day on, until the next period starts, the account takes its new rows from this source. `from` is null only on the
 * first period, which runs from the account's start.
 */
export interface SourcePeriod<S extends PeriodSource = PeriodSource> {
  readonly source: S
  readonly from: CivilDate | null
}

/**
 * Whether a period of the source takes a new row of the origin. An automation and the provider's file each take their own rows
 * alone. By hand takes what a person brings: typing, the chat's copying and files.
 */
export function takesOrigin(source: PeriodSource, origin: RowOrigin): boolean {
  if (source === 'bank-link' || source === 'mail') return origin === 'automation'
  return source === 'by-hand' ? origin !== 'automation' : origin === source
}

/** The source of the period the day falls in, or null for a day before the first period. */
export function sourceOn<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], day: CivilDate): S | null {
  let source: S | null = null
  for (const period of periods) {
    if (period.from !== null && period.from > day) break
    source = period.source
  }
  return source
}

/** Whether a new row of the origin may go on a day: only when the day's period takes that origin. */
export function takesRowOn(periods: readonly SourcePeriod[], day: CivilDate, origin: RowOrigin): boolean {
  const source = sourceOn(periods, day)
  return source !== null && takesOrigin(source, origin)
}

/** The periods with one period that runs from the day on, null for the account's start, in place of what was there from it. Two periods of one source in a row become one. */
export function periodsFrom<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], source: S, day: CivilDate | null): readonly SourcePeriod<S>[] {
  const kept = day === null ? [] : periods.filter((period) => period.from === null || period.from < day)
  if (kept.length === 0) return [{ source, from: null }]
  return kept[kept.length - 1]!.source === source ? kept : [...kept, { source, from: day }]
}

/** The periods with the source over the days from `from` to `to`, and what came after `to` again from the day after. */
export function periodsOver<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], source: S, from: CivilDate, to: CivilDate): readonly SourcePeriod<S>[] {
  const next = addDays(to, 1)
  const resumes = sourceOn(periods, next) ?? source
  const later = periods.filter((period) => period.from !== null && period.from > next)
  const joined: SourcePeriod<S>[] = [...periodsFrom(periods, source, from)]
  for (const period of [{ source: resumes, from: next }, ...later]) if (period.source !== joined[joined.length - 1]!.source) joined.push(period)
  return joined
}

/** The periods of an account that starts on the day: the period the day falls in becomes the first, from the start. */
export function periodsSince<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], start: CivilDate): readonly SourcePeriod<S>[] {
  const first = sourceOn(periods, start) ?? periods[0]?.source
  if (first === undefined) return []
  const since: SourcePeriod<S>[] = [{ source: first, from: null }]
  for (const period of periods) if (period.from !== null && period.from > start && period.source !== since[since.length - 1]!.source) since.push(period)
  return since
}

/** The periods as a cell holds them, such as `provider-file, bank-link 2025-06-01`. */
export function periodsText(periods: readonly SourcePeriod[]): string {
  return periods.map((period) => (period.from === null ? period.source : `${period.source} ${period.from}`)).join(', ')
}

/** Why a list of periods cannot be kept: none, a later one without its day, the first with one, days out of order, or one source twice in a row. */
export type PeriodsRefusal = 'none' | 'first-has-day' | 'later-without-day' | 'out-of-order' | 'same-source'

/** Why the periods cannot be kept, or null when they can. */
export function periodsRefusal(periods: readonly SourcePeriod[]): PeriodsRefusal | null {
  if (periods.length === 0) return 'none'
  if (periods[0]!.from !== null) return 'first-has-day'
  for (const [place, period] of periods.entries()) {
    if (place === 0) continue
    const earlier = periods[place - 1]!
    if (period.from === null) return 'later-without-day'
    if (earlier.from !== null && period.from <= earlier.from) return 'out-of-order'
    if (earlier.source === period.source) return 'same-source'
  }
  return null
}

/** The periods a cell holds, each a source with its day after the first, or null when one is not a source of `allowed` or the list cannot be kept. */
export function periodsOfText<S extends PeriodSource>(text: string, allowed: readonly S[], parseDay: (text: string) => CivilDate | null): readonly SourcePeriod<S>[] | null {
  const periods: SourcePeriod<S>[] = []
  for (const entry of text.split(',').map((part) => part.trim())) {
    const [sourceText, dayText, ...rest] = entry.split(/\s+/)
    const source = allowed.find((one) => one === sourceText)
    if (rest.length > 0 || source === undefined) return null
    const from = dayText === undefined ? null : parseDay(dayText)
    if (dayText !== undefined && from === null) return null
    periods.push({ source, from })
  }
  return periodsRefusal(periods) === null ? periods : null
}

/** A run of days whose source a change of periods changes, with the source before and after. `from` null is the account's start, and `to` null runs on. */
export interface HandedDays<S extends PeriodSource = PeriodSource> {
  readonly from: CivilDate | null
  readonly to: CivilDate | null
  readonly before: S
  readonly after: S
}

/** The source of the first run of days, from the account's start, or of the day. */
function sourceFrom<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], day: CivilDate | null): S | null {
  if (day !== null) return sourceOn(periods, day)
  const first = periods[0]
  return first !== undefined && first.from === null ? first.source : null
}

/** The days whose source the change changes, in order, each run as long as both sources hold. */
export function handedDays<S extends PeriodSource>(before: readonly SourcePeriod<S>[], after: readonly SourcePeriod<S>[]): readonly HandedDays<S>[] {
  const edges = [...new Set([...before, ...after].flatMap((period) => (period.from === null ? [] : [period.from])))].sort()
  const starts: readonly (CivilDate | null)[] = [null, ...edges]
  const runs: HandedDays<S>[] = []
  for (const [place, from] of starts.entries()) {
    const next = edges[place]
    const to = next === undefined ? null : addDays(next, -1)
    const was = sourceFrom(before, from)
    const is = sourceFrom(after, from)
    if (was === null || is === null || was === is) continue
    const last = runs[runs.length - 1]
    if (last !== undefined && last.to !== null && from !== null && addDays(last.to, 1) === from && last.before === was && last.after === is) runs[runs.length - 1] = { ...last, to }
    else runs.push({ from, to, before: was, after: is })
  }
  return runs
}

/** Whether the day lies in one of the runs. */
export function inHandedDays(runs: readonly HandedDays[], day: CivilDate): boolean {
  return runs.some((run) => (run.from === null || run.from <= day) && (run.to === null || day <= run.to))
}

/** A row as a change of periods reads it: its day and where it came from. */
export interface DatedOrigin {
  readonly date: CivilDate
  readonly origin: RowOrigin
}

/**
 * Why a change of periods may not be written, or null when it may: a handed day is already filed, before `firstOpen`, or rows
 * the new periods would not take sit on the handed days. `rows` are the account's rows as the write leaves them, so a write
 * that carries those rows out is taken, and an Undo after the new source brought a row on the handed days is refused.
 */
export type PeriodsChangeRefusal = { readonly kind: 'filed'; readonly firstOpen: CivilDate } | { readonly kind: 'rows-of-another-source'; readonly count: number; readonly runs: readonly HandedDays[] }

export function periodsChangeRefusal(before: readonly SourcePeriod[], after: readonly SourcePeriod[], rows: readonly DatedOrigin[], firstOpen: CivilDate | null): PeriodsChangeRefusal | null {
  const runs = handedDays(before, after)
  if (runs.length === 0) return null
  if (firstOpen !== null && runs.some((run) => run.from === null || run.from < firstOpen)) return { kind: 'filed', firstOpen }
  const count = rows.filter((row) => inHandedDays(runs, row.date) && !takesRowOn(after, row.date, row.origin)).length
  return count === 0 ? null : { kind: 'rows-of-another-source', count, runs }
}

/** How many rows of each origin sit in a period, and the period's last day, null while it runs on. */
export interface PeriodTally<S extends PeriodSource = PeriodSource> {
  readonly period: SourcePeriod<S>
  readonly to: CivilDate | null
  readonly counts: Readonly<Record<RowOrigin, number>>
}

/** Each period with how many rows of each origin sit on its days. */
export function periodTallies<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], rows: readonly DatedOrigin[]): readonly PeriodTally<S>[] {
  return periods.map((period, place) => {
    const next = periods[place + 1]?.from ?? null
    const counts = { automation: 0, 'provider-file': 0, 'by-hand': 0 }
    for (const row of rows) if ((period.from === null || row.date >= period.from) && (next === null || row.date < next)) counts[row.origin] += 1
    return { period, to: next === null ? null : addDays(next, -1), counts }
  })
}
