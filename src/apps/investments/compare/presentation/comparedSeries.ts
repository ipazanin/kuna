import type { ComparedLine } from '../domain/comparedLine'
import { tokenColour } from '../../../../shared/charts/chartTokens'
import type { ChartTokens } from '../../../../shared/charts/chartTokens'
import type { LineSeries } from '../../../../shared/charts/echarts'
import { formatPercent } from '../../../../shared/money/moneyFormat'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** The compared line, dashed in the grey of anything the portfolio is measured against. */
export function comparedSeries(line: ComparedLine): LineSeries {
  return {
    type: 'line',
    name: line.name,
    color: tokenColour('--invest-reference'),
    showSymbol: false,
    lineStyle: { width: 2, type: [5, 4] },
    data: [...line.change],
  }
}

export function comparedLegend(line: ComparedLine): LegendEntry {
  return { label: line.name, colour: 'var(--invest-reference)', mark: 'dashed' }
}

/** The labels of a value axis of change since the first day, signed so a fall reads as one. */
export function changeAxisLabel(tokens: ChartTokens): { color: string; fontSize: number; formatter: (share: number) => string } {
  return { color: tokens.inkMuted, fontSize: 11, formatter: (share: number) => formatPercent(share, 'always') }
}
