import { use } from 'echarts/core'
import type { ComposeOption } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import type { BarSeriesOption } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import type { GridComponentOption, TooltipComponentOption } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

/** Only the registered parts reach the bundle. A chart type missing here renders nothing. */
use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

export type ChartOption = ComposeOption<BarSeriesOption | GridComponentOption | TooltipComponentOption>
