import type { DrillTarget } from '../../../filters/domain/drillTarget'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../shared/money/money'
import type { RuleCitation } from './schema'

export type FigureBasis = 'ledger' | 'invoices' | 'assets' | 'plan' | 'accountant' | 'assumption'

/**
 * A computed amount with the rows behind it and the rules that gave it, so a screen can answer
 * "which rule gives this number". `steps` is the build-up a screen expands.
 */
export interface TracedFigure {
  /** What the figure is. When `on` is set, the label leads up to that day, such as "Advance for Sep 2026, due". */
  readonly label: string
  /** The day a screen writes after the label in its own date format. Null when the label names no day. */
  readonly on: CivilDate | null
  readonly amount: Money
  /** The ledger rows, advances or invoices behind it. Null for a figure from the plan or the accountant. */
  readonly drill: DrillTarget | null
  readonly basis: FigureBasis
  readonly rules: readonly RuleCitation[]
  readonly steps: readonly TracedFigure[]
}
