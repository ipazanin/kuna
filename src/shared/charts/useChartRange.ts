import { computed } from 'vue'
import type { ComputedRef, WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import { overlapOf } from '../calendar/dateRange'
import type { DateRange } from '../calendar/dateRange'
import { chartRangeOfText, chartRangeText, chartRanges, rangeWindow, sameChartRange } from './chartRange'
import type { ChartPreset, ChartRange } from './chartRange'

export interface ChartRangeChoice {
  /** The presets the chart offers, All last. Only All means nothing to pick, and no custom range either. */
  readonly ranges: ComputedRef<ChartPreset[]>
  readonly range: WritableComputedRef<ChartRange>
  /** The days the range keeps, null for All. */
  readonly window: ComputedRef<DateRange | null>
  /** The days the chart's figures run over, which a custom range keeps inside. Null for a chart with none. */
  readonly span: ComputedRef<DateRange | null>
}

/**
 * The range a screen's time charts show, kept in the address as `?range=` like the screen's other view choices, so
 * every chart on the screen shows the same span. The range a chart opens on, All unless it says, stays out of the
 * address. A preset the chart does not offer, or a custom range that misses its span or comes where no preset is
 * offered, reads as the opening range.
 */
export function useChartRange(span: () => DateRange | null, today: () => CivilDate, opening: () => ChartRange = () => 'all'): ChartRangeChoice {
  const route = useRoute()
  const router = useRouter()
  const shownSpan = computed(span)
  const ranges = computed((): ChartPreset[] => (shownSpan.value === null ? ['all'] : chartRanges(shownSpan.value, today())))
  const range = computed({
    get: (): ChartRange => {
      const asked = typeof route.query.range === 'string' ? chartRangeOfText(route.query.range) : null
      if (asked === null) return opening()
      if (typeof asked === 'string') return ranges.value.includes(asked) ? asked : opening()
      return ranges.value.length > 1 && shownSpan.value !== null && overlapOf(asked, shownSpan.value) !== null ? asked : opening()
    },
    set: (picked: ChartRange) => {
      const { range: _left, ...others } = route.query
      void router.replace({ query: sameChartRange(picked, opening()) ? others : { ...others, range: chartRangeText(picked) } })
    },
  })
  return { ranges, range, window: computed(() => rangeWindow(range.value, today())), span: shownSpan }
}
