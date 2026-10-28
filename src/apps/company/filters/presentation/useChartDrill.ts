import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import { monthAxisLabel } from '../../../../shared/calendar/monthLabel'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import type { ChartPointSelection } from '../../../../shared/ui/ChartCard.vue'
import { useFilters } from '../application/filterStore'
import type { DrillChart } from './chartDrill'

/**
 * What a chart's marks open. A click drills at once. On a phone a tap first chooses the mark, whose
 * "View rows" the chart then offers, and a second tap on the same mark drills, so one tap never both
 * shows a figure and leaves the screen.
 */
export function useChartDrill(chart: () => DrillChart) {
  const { drillLocation } = useFilters()
  const router = useRouter()
  const phone = usePhoneLayout()
  const chosen = shallowRef<ChartPointSelection | null>(null)

  watch(chart, () => {
    chosen.value = null
  })

  const readableCategory = monthAxisLabel('long')
  const chosenLabel = computed(() => {
    const selection = chosen.value
    return selection === null ? '' : [selection.seriesName, readableCategory(selection.category)].filter((part) => part !== '').join(', ')
  })

  function linkAt(selection: ChartPointSelection): RouteLocationRaw | null {
    const target = chart().drillAt(selection)
    return target === null ? null : drillLocation(target)
  }

  function drill(selection: ChartPointSelection): void {
    const location = linkAt(selection)
    if (location !== null) {
      void router.push(location)
    }
  }

  function select(selection: ChartPointSelection): void {
    if (!phone.value) {
      drill(selection)
      return
    }
    const previous = chosen.value
    if (previous !== null && previous.seriesName === selection.seriesName && previous.dataIndex === selection.dataIndex) {
      drill(selection)
      return
    }
    chosen.value = linkAt(selection) === null ? null : selection
  }

  return { phone, chosen, chosenLabel, linkAt, drill, select }
}
