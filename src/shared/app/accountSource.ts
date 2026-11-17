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
