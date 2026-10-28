import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { YearEndStatement } from '../yearEnd/yearEnd'
import type { TracedFigure } from '../../ruleset/tracedFigure'

/**
 * How an adjustment stands against the accountant. `matched` agrees with the accountant's own line
 * for it. `explained` follows from the workbook and the rules, with no accountant figure to hold it
 * against. `judgement` takes the accountant's figure where it rests on a choice the ledger cannot
 * show, and its amount is the difference to ours. `open` is what nothing explains.
 */
export type AdjustmentKind = 'matched' | 'explained' | 'judgement' | 'open'

/** What an adjustment changes: the year's profit, only the tax base, or only which line a figure sits on. */
export type AdjustmentEffect = 'profit' | 'tax-base' | 'placement'

export type AdjustmentId =
  | 'revenue-by-delivery'
  | 'owner-loans'
  | 'grant-receipts'
  | 'grant-release'
  | 'grant-schedule'
  | 'profit-distributions'
  | 'corporate-tax-paid'
  | 'vat-settlements'
  | 'input-vat'
  | 'capital-purchases'
  | 'depreciation'
  | 'asset-write-offs'
  | 'arrears-reversed'
  | 'arrears-accrued'
  | 'arrears-cut-off'
  | 'prepaid-spread'
  | 'representation-as-booked'
  | 'corporate-income-tax'
  | 'cost-placement'
  | 'liability-placement'
  | 'receivable-placement'
  | 'unexplained-before-tax'
  | 'unexplained-after-tax'

export interface YearEndLineRef {
  readonly statement: Exclude<YearEndStatement, 'konto'>
  readonly line: string
}

export interface AccrualAdjustment {
  readonly id: AdjustmentId
  readonly kind: AdjustmentKind
  readonly effect: AdjustmentEffect
  /**
   * Positive when it raises profit, or the tax base. A placement adds up to zero, and its steps are
   * what it moves onto each line.
   */
  readonly figure: TracedFigure
  /** The year-end lines it rests on or explains. */
  readonly lines: readonly YearEndLineRef[]
}

export function withDrill(figure: TracedFigure, drill: DrillTarget | null): TracedFigure {
  return { ...figure, drill }
}
