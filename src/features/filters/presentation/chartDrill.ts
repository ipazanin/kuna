import type { ChartOption } from '../../../shared/charts/echarts'
import type { ChartPointSelection } from '../../../shared/ui/ChartCard.vue'
import { useFilters } from '../application/filterStore'
import type { DrillTarget } from '../domain/drillTarget'

/** A chart ready for a ChartCard: its option, its words for a screen reader, and where a click leads. */
export interface DrillChart {
  readonly option: ChartOption
  readonly description: string
  drillAt(selection: ChartPointSelection): DrillTarget | null
}

/** A click handler for a ChartCard that opens whatever the clicked mark drills to. */
export function useChartDrill(): (chart: DrillChart, selection: ChartPointSelection) => void {
  const { openDrill } = useFilters()
  return (chart, selection) => {
    const drill = chart.drillAt(selection)
    if (drill !== null) {
      void openDrill(drill)
    }
  }
}
