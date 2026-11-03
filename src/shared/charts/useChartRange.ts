import { computed } from 'vue'
import type { ComputedRef, WritableComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { CivilDate } from '../calendar/civilDate'
import type { DateRange } from '../calendar/dateRange'
import { chartRanges, rangeWindow } from './chartRange'
import type { ChartRange } from './chartRange'

export interface ChartRangeChoice {
  /** The ranges the chart offers, All last. Only All means nothing to pick. */
  readonly ranges: ComputedRef<ChartRange[]>
  readonly range: WritableComputedRef<ChartRange>
  /** The days the range keeps, null for All. */
  readonly window: ComputedRef<DateRange | null>
}

/**
 * The range a screen's time charts show, kept in the address as `?range=` like the screen's other view
 * choices, so every chart on the screen shows the same span. All stays out of the address, and a range
 * the charts do not offer reads as All.
 */
export function useChartRange(span: () => DateRange | null, today: () => CivilDate): ChartRangeChoice {
  const route = useRoute()
  const router = useRouter()
  const ranges = computed((): ChartRange[] => {
    const shown = span()
    return shown === null ? ['all'] : chartRanges(shown, today())
  })
  const range = computed({
    get: (): ChartRange => ranges.value.find((offered) => offered === route.query.range) ?? 'all',
    set: (picked: ChartRange) => {
      const { range: _left, ...others } = route.query
      void router.replace({ query: picked === 'all' ? others : { ...others, range: picked } })
    },
  })
  return { ranges, range, window: computed(() => rangeWindow(range.value, today())) }
}
