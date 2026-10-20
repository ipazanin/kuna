import type { ChartOption } from '../../../shared/charts/echarts'
import type { ChartPointSelection } from '../../../shared/ui/ChartCard.vue'
import type { DrillTarget } from '../domain/drillTarget'

/** A chart ready for a DrillChartCard: its option, its words for a screen reader, and the rows a click opens. */
export interface DrillChart {
  readonly option: ChartOption
  readonly description: string
  /** How the table view writes a value, when the chart's values are not money. */
  readonly formatValue?: (value: number) => string
  drillAt(selection: ChartPointSelection): DrillTarget | null
}
