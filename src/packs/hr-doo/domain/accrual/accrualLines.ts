import type { YearEndStatement } from '../../../../features/workbook/domain/yearEnd'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { TracedRate } from '../cit/citLiability'
import type { AdjustmentId } from './accrualAdjustment'

interface LineBase {
  readonly statement: Exclude<YearEndStatement, 'konto'>
  /** The year-end tab's line id. */
  readonly line: string
  /** The judgement adjustments the figure rests on. */
  readonly judgements: readonly AdjustmentId[]
}

/** One of our figures for a line of the year-end tab. */
export type AccrualLine =
  | (LineBase & { readonly kind: 'money'; readonly figure: TracedFigure })
  | (LineBase & { readonly kind: 'rate'; readonly rate: TracedRate })
  | (LineBase & { readonly kind: 'count'; readonly label: string; readonly count: number })

export type MoneyLine = Extract<AccrualLine, { readonly kind: 'money' }>

export function moneyLine(statement: LineBase['statement'], line: string, figure: TracedFigure, judgements: readonly AdjustmentId[] = []): MoneyLine {
  return { kind: 'money', statement, line, figure, judgements: [...new Set(judgements)] }
}
