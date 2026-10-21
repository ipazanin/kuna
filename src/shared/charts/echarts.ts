import { use } from 'echarts/core'
import type { ComposeOption } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption } from 'echarts/charts'
import { AriaComponent, DataZoomSliderComponent, GridComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components'
import type {
  AriaComponentOption,
  DataZoomComponentOption,
  GridComponentOption,
  MarkAreaComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

/** Only the registered parts reach the bundle. A chart type missing here renders nothing. */
use([BarChart, LineChart, PieChart, AriaComponent, DataZoomSliderComponent, GridComponent, MarkAreaComponent, TooltipComponent, CanvasRenderer])

export type ChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | AriaComponentOption
  | DataZoomComponentOption
  | GridComponentOption
  | MarkAreaComponentOption
  | TooltipComponentOption
>

export type BarSeries = BarSeriesOption

export type LineSeries = LineSeriesOption
