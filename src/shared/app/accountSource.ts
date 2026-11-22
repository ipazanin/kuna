import { addDays } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'

/**
 * Where a new row comes from: the account's automation, the provider's own file a person brings, such as a bank's statement
 * export or a broker's report, or by hand, which is typing, the chat's copying and any other file.
 */
export type RowOrigin = 'automation' | 'provider-file' | 'by-hand'

const ORIGINS: readonly RowOrigin[] = ['automation', 'provider-file', 'by-hand']

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

/** Where a period's rows come from: the account's automation, the provider's own file, or by hand. Each app offers the ones it has. */
export type PeriodSource = 'bank-link' | 'mail' | 'provider-file' | 'by-hand'

/**
 * From this day on, until the next period starts, the account takes its new rows from this source. `from` is null only on the
 * first period, which then runs from the account's start. An app whose accounts have no opening day may give the first a day, and
 * the account takes no row before it.
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

/**
 * Where an account's first period starts: always from the account's own start, as in Spending, whose opening day is that start,
 * or from the start or a day of its own, as in an app whose accounts have no opening day. Before a first period's day the account
 * takes no row.
 */
export type FirstPeriod = 'from-start' | 'may-have-day'

/** Why the periods cannot be kept, or null when they can. */
export function periodsRefusal(periods: readonly SourcePeriod[], first: FirstPeriod = 'from-start'): PeriodsRefusal | null {
  if (periods.length === 0) return 'none'
  if (first === 'from-start' && periods[0]!.from !== null) return 'first-has-day'
  for (const [place, period] of periods.entries()) {
    if (place === 0) continue
    const earlier = periods[place - 1]!
    if (period.from === null) return 'later-without-day'
    if (earlier.from !== null && period.from <= earlier.from) return 'out-of-order'
    if (earlier.source === period.source) return 'same-source'
  }
  return null
}

/**
 * Why the periods of an account whose first period may start on a day of its own cannot be kept, or null when they can. A first
 * period of a source in `dated` needs its day, as an automation's search starts on it.
 */
export function datedPeriodsRefusal<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], dated: readonly S[]): PeriodsRefusal | 'first-without-day' | null {
  const refusal = periodsRefusal(periods, 'may-have-day')
  if (refusal !== null) return refusal
  return dated.includes(periods[0]!.source) && periods[0]!.from === null ? 'first-without-day' : null
}

/** The periods a cell holds, each a source with its day after the first, or null when one is not a source of `allowed` or the list cannot be kept. */
export function periodsOfText<S extends PeriodSource>(
  text: string,
  allowed: readonly S[],
  parseDay: (text: string) => CivilDate | null,
  first: FirstPeriod = 'from-start',
): readonly SourcePeriod<S>[] | null {
  const periods: SourcePeriod<S>[] = []
  for (const entry of text.split(',').map((part) => part.trim())) {
    const [sourceText, dayText, ...rest] = entry.split(/\s+/)
    const source = allowed.find((one) => one === sourceText)
    if (rest.length > 0 || source === undefined) return null
    const from = dayText === undefined ? null : parseDay(dayText)
    if (dayText !== undefined && from === null) return null
    periods.push({ source, from })
  }
  return periodsRefusal(periods, first) === null ? periods : null
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

/** A run of days and its source before and after a change, null for days before the first period, which take no row. */
interface SourceRun<S extends PeriodSource> {
  readonly from: CivilDate | null
  readonly to: CivilDate | null
  readonly before: S | null
  readonly after: S | null
}

/** The days whose source the change changes, in order, each run as long as both sources hold. */
function changedRuns<S extends PeriodSource>(before: readonly SourcePeriod<S>[], after: readonly SourcePeriod<S>[]): readonly SourceRun<S>[] {
  const edges = [...new Set([...before, ...after].flatMap((period) => (period.from === null ? [] : [period.from])))].sort()
  const starts: readonly (CivilDate | null)[] = [null, ...edges]
  const runs: SourceRun<S>[] = []
  for (const [place, from] of starts.entries()) {
    const next = edges[place]
    const to = next === undefined ? null : addDays(next, -1)
    const was = sourceFrom(before, from)
    const is = sourceFrom(after, from)
    if (was === is) continue
    const last = runs[runs.length - 1]
    if (last !== undefined && last.to !== null && from !== null && addDays(last.to, 1) === from && last.before === was && last.after === is) runs[runs.length - 1] = { ...last, to }
    else runs.push({ from, to, before: was, after: is })
  }
  return runs
}

/** The days whose source the change changes from one source to another, in order. */
export function handedDays<S extends PeriodSource>(before: readonly SourcePeriod<S>[], after: readonly SourcePeriod<S>[]): readonly HandedDays<S>[] {
  return changedRuns(before, after).flatMap((run) => (run.before === null || run.after === null ? [] : [{ from: run.from, to: run.to, before: run.before, after: run.after }]))
}

/** A run of days before the first period that a change gives a source, as an earlier first day does. */
export interface GivenDays<S extends PeriodSource = PeriodSource> {
  readonly from: CivilDate | null
  readonly to: CivilDate | null
  readonly after: S
}

/** The days that took no row before the change and take one of a source after it. Never any while the first period runs from the account's start. */
export function givenDays<S extends PeriodSource>(before: readonly SourcePeriod<S>[], after: readonly SourcePeriod<S>[]): readonly GivenDays<S>[] {
  return changedRuns(before, after).flatMap((run) => (run.before === null && run.after !== null ? [{ from: run.from, to: run.to, after: run.after }] : []))
}

/** Whether the day lies in one of the runs. */
export function inHandedDays(runs: readonly Pick<HandedDays, 'from' | 'to'>[], day: CivilDate): boolean {
  return runs.some((run) => (run.from === null || run.from <= day) && (run.to === null || day <= run.to))
}

/** A row as a change of periods reads it: its day and where it came from. */
export interface DatedOrigin {
  readonly date: CivilDate
  readonly origin: RowOrigin
}

/**
 * Why a change of periods may not be written, or null when it may: a handed day whose new source brings rows the old one did not
 * take is already filed, before `firstOpen`, or rows
 * the new periods would not take sit on the handed days. `rows` are the account's rows as the write leaves them, so a write
 * that carries those rows out is taken, and an Undo after the new source brought a row on the handed days is refused.
 */
export type PeriodsChangeRefusal =
  /** `day` is the first handed day, null for the account's start. */
  { readonly kind: 'filed'; readonly firstOpen: CivilDate; readonly day: CivilDate | null } | { readonly kind: 'rows-of-another-source'; readonly count: number }

export function periodsChangeRefusal(before: readonly SourcePeriod[], after: readonly SourcePeriod[], rows: readonly DatedOrigin[], firstOpen: CivilDate | null): PeriodsChangeRefusal | null {
  const runs = [...handedDays(before, after), ...givenDays(before, after)]
  if (runs.length === 0) return null
  // Only days an automation or the provider's file now fills, with an origin the old source did not take, bring rows a person did not type onto a filed day.
  const bringsNew = (run: HandedDays | GivenDays): boolean =>
    run.after !== 'by-hand' && ORIGINS.some((origin) => takesOrigin(run.after, origin) && !('before' in run && takesOrigin(run.before, origin)))
  const filed = firstOpen === null ? undefined : runs.find((run) => (run.from === null || run.from < firstOpen) && bringsNew(run))
  if (firstOpen !== null && filed !== undefined) return { kind: 'filed', firstOpen, day: filed.from }
  const count = rows.filter((row) => inHandedDays(runs, row.date) && !takesRowOn(after, row.date, row.origin)).length
  return count === 0 ? null : { kind: 'rows-of-another-source', count }
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

/** The runs of days of the source's periods, each from its day, null for the account's start, to the day before the next period, null while it runs on. */
export function runsOf<S extends PeriodSource>(periods: readonly SourcePeriod<S>[], source: S): readonly Pick<HandedDays, 'from' | 'to'>[] {
  return periods.flatMap((period, place) => {
    if (period.source !== source) return []
    const next = periods[place + 1]?.from ?? null
    return [{ from: period.from, to: next === null ? null : addDays(next, -1) }]
  })
}

/** The first day a period of the source starts on among the accounts, where its automation's search starts, or null while no period of it has a day. */
export function earliestFrom<S extends PeriodSource>(accounts: Iterable<readonly SourcePeriod<S>[]>, source: S): CivilDate | null {
  const days = [...accounts].flatMap((periods) => periods.flatMap((period) => (period.source === source && period.from !== null ? [period.from] : [])))
  return days.length === 0 ? null : days.reduce((first, day) => (day < first ? day : first))
}

/**
 * The periods of an account a file from before periods kept with one way its rows came in, from its `rows_from`, `starts_on` and
 * `also_from` cells: by hand from its start when `automation` is null, or the automation from its start day. The days before
 * that day took no row then and take none now. One that also took the provider's own file takes it on those earlier days.
 */
export function periodsOfIntake<S extends 'bank-link' | 'mail'>(
  automation: { readonly source: S; readonly startsOn: CivilDate; readonly takesFile: boolean } | null,
): readonly SourcePeriod<S | 'provider-file' | 'by-hand'>[] {
  if (automation === null) return [{ source: 'by-hand', from: null }]
  const { source, startsOn, takesFile } = automation
  return takesFile
    ? [
        { source: 'provider-file', from: null },
        { source, from: startsOn },
      ]
    : [{ source, from: startsOn }]
}
