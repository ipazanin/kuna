import type { CivilDate } from '../../calendar/civilDate'
import type { Money } from '../../money/money'

/**
 * How Kuna built a figure on screen: each step's amount, the rule versions it rests on, and the steps below it. A step that
 * names a party, such as a client or an employee, or stands for one row is left out when the trace is built and only counted.
 */
export interface FigureTrace {
  readonly label: string
  /** The day the label leads up to, or null when it names none. */
  readonly on: CivilDate | null
  readonly amount: Money
  readonly basis: string
  readonly rules: readonly { readonly id: string; readonly validFrom: string }[]
  readonly steps: readonly FigureTrace[]
  /** The steps below this one that were left out for naming a party or standing for one row. */
  readonly stepsLeftOut: number
}

/**
 * What a person tagged on a screen to ask the chat about: a record, a figure of a report, a place, or a figure's build-up.
 * Only a build-up holds content, and it reaches the model through a read, never with the tag itself.
 */
export type ChatElementAbout =
  | { readonly kind: 'record'; readonly app: string; readonly recordKind: string; readonly id: string }
  | { readonly kind: 'figure'; readonly app: string; readonly report: string; readonly period: string | null; readonly label: string }
  | { readonly kind: 'place'; readonly app: string; readonly route: `/${string}` }
  | { readonly kind: 'build-up'; readonly app: string; readonly trace: FigureTrace; readonly subtitle: string; readonly employees: boolean }
