import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { TracedFigure } from '../../ruleset/tracedFigure'

/**
 * The bank rows and owner advances behind figures, as one drill to Transactions over the days and
 * categories they span. Null when no row is behind them, or when a drill names no day range to join.
 */
export function rowsBehind(figures: readonly TracedFigure[]): DrillTarget | null {
  const drills = figures.flatMap(drillsIn)
  if (drills.length <= 1) {
    return drills[0] ?? null
  }
  const ranges = drills.flatMap((drill) => (drill.filters.period?.preset === 'custom' ? [drill.filters.period.range] : []))
  if (ranges.length !== drills.length) {
    return null
  }
  const froms = ranges.map((range) => range.from).sort()
  const tos = ranges.map((range) => range.to).sort()
  return drillToTransactions({
    period: { preset: 'custom', range: { from: froms[0] as CivilDate, to: tos[tos.length - 1] as CivilDate } },
    categories: [...new Set(drills.flatMap((drill) => drill.filters.categories ?? []))],
  })
}

function drillsIn(figure: TracedFigure): DrillTarget[] {
  return figure.drill !== null ? [figure.drill] : figure.steps.flatMap(drillsIn)
}
