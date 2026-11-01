import { use } from 'echarts/core'
import type { ComposeOption } from 'echarts/core'
import { BarChart, LineChart, PieChart, TreemapChart } from 'echarts/charts'
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption, TreemapSeriesOption } from 'echarts/charts'
import { AriaComponent, DataZoomSliderComponent, GridComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components'
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  MarkPointComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { LabelLayout } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'

/** Only the registered parts reach the bundle. A chart type missing here renders nothing. */
use([
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  AriaComponent,
  DataZoomSliderComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  LabelLayout,
  CanvasRenderer,
])

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | TreemapSeriesOption
  | AriaComponentOption
  | DataZoomComponentOption
  | GridComponentOption
  | MarkAreaComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
  | TooltipComponentOption
>

export type BarSeries = BarSeriesOption

export type LineSeries = LineSeriesOption
