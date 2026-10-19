import type { RouteLocationRaw } from 'vue-router'

import type { ChartOption } from '../../../shared/charts/echarts'
import type { ChartPointSelection } from '../../../shared/ui/ChartCard.vue'
import type { DrillTarget } from '../domain/drillTarget'

interface DrillableChart {
  readonly option: ChartOption
  readonly description: string
  /** How the table view writes a value, when the chart's values are not money. */
  readonly formatValue?: (value: number) => string
}

/** A chart ready for a DrillChartCard: its option, its words for a screen reader, and the rows a click opens. */
export interface DrillChart extends DrillableChart {
  drillAt(selection: ChartPointSelection): DrillTarget | null
}

/** A chart whose marks open a place the shared filters do not describe, such as a month further down the same screen. */
export interface LinkChart extends DrillableChart {
  linkAt(selection: ChartPointSelection): RouteLocationRaw | null
}
