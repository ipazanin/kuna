import type { ChartOption } from '../../../shared/charts/echarts'
import type { ChartPointSelection } from '../../../shared/ui/ChartCard.vue'
import type { DrillTarget } from '../domain/drillTarget'

/** A chart ready for a DrillChartCard: its option, its words for a screen reader, and where a click leads. */
export interface DrillChart {
  readonly option: ChartOption
  readonly description: string
  drillAt(selection: ChartPointSelection): DrillTarget | null
  /** How the table view writes a value, when the chart's values are not money. */
  readonly formatValue?: (value: number) => string
}
