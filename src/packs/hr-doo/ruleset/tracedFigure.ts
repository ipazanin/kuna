import type { DrillTarget } from '../../../features/filters/domain/drillTarget'
import type { Money } from '../../../shared/money/money'
import type { RuleCitation } from './schema'

export type FigureBasis = 'ledger' | 'invoices' | 'assets' | 'plan' | 'accountant' | 'assumption'

/**
 * A computed amount with the rows behind it and the rules that gave it, so a screen can answer
 * "which rule gives this number". `steps` is the build-up a screen expands.
 */
export interface TracedFigure {
  readonly label: string
  readonly amount: Money
  /** The ledger rows, advances or invoices behind it. Null for a figure from the plan or the accountant. */
  readonly drill: DrillTarget | null
  readonly basis: FigureBasis
  readonly rules: readonly RuleCitation[]
  readonly steps: readonly TracedFigure[]
}
