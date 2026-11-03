<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import USelect from '@nuxt/ui/components/Select.vue'

import type { BenchmarkState } from '../domain/benchmark'
import type { PerformancePeriod } from '../domain/performancePeriod'
import type { Performance, PeriodPerformance } from '../domain/portfolioPerformance'
import PerformanceNotice from './PerformanceNotice.vue'
import { periodKey } from './performanceLinks'
import { words } from './words'
import { listInWords } from '../../../../shared/text/listInWords'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import { words as chartWords } from '../../../../shared/ui/words'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** The period bar of a tab that follows the period picked, what its figures could not use, and the tab's cards once the period has figures. */
const props = defineProps<{
  periods: readonly PerformancePeriod[]
  period: PerformancePeriod
  performance: Performance
  benchmark: BenchmarkState
}>()

defineSlots<{ default: (scope: { performance: PeriodPerformance }) => unknown }>()

const route = useRoute()
const router = useRouter()

const rollingChoices = computed(() => props.periods.filter((offered) => offered.kind === 'years' || offered.kind === 'all').map(periodChoice))
const yearChoices = computed(() =>
  props.periods
    .filter((offered) => offered.kind === 'year')
    .map(periodChoice)
    .reverse(),
)
const pickedYear = computed(() => (props.period.kind === 'year' || props.period.kind === 'quarter' ? String(props.period.year) : ''))
/** Once a year is picked: the whole year, then each of its quarters on offer. */
const partChoices = computed(() =>
  props.periods
    .filter((offered) => (offered.kind === 'year' || offered.kind === 'quarter') && String(offered.year) === pickedYear.value)
    .map((offered) => ({ value: periodKey(offered), label: offered.kind === 'year' ? words.wholeYear : periodLabel(offered) })),
)
const figures = computed(() => (props.performance.kind === 'figures' ? props.performance : null))
const heldBackNames = computed(() => {
  const shown = props.performance
  return shown.kind === 'held-back' ? listInWords([...shown.heldBack.instruments.map((instrument) => instrument.name), ...shown.heldBack.currencies]) : ''
})

function periodChoice(offered: PerformancePeriod): { value: string; label: string } {
  return { value: periodKey(offered), label: periodLabel(offered) }
}

function periodLabel(offered: PerformancePeriod): string {
  switch (offered.kind) {
    case 'years':
      return chartWords.chart.ranges[`${offered.years}y`]
    case 'all':
      return chartWords.chart.ranges.all
    case 'year':
      return String(offered.year)
    case 'quarter':
      return words.quarter(offered.quarter)
  }
}

/** Another year keeps the quarter picked when that quarter is on offer in it, and is otherwise the whole year. */
function pickYear(year: string): void {
  const shown = props.period
  const sameQuarter = shown.kind === 'quarter' ? periodKey({ kind: 'quarter', year: Number(year), quarter: shown.quarter }) : null
  pick(sameQuarter !== null && props.periods.some((offered) => periodKey(offered) === sameQuarter) ? sameQuarter : year)
}

/** All, the period the screen opens on, stays out of the address. */
function pick(key: string): void {
  const { period: _left, ...others } = route.query
  void router.replace({ query: key === 'all' ? others : { ...others, period: key } })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="periods.length > 1" class="flex flex-wrap items-center gap-1.5">
      <ChoiceButtons :model-value="periodKey(period)" :options="rollingChoices" :label="words.periods" data-testid="performance-periods" @update:model-value="pick" />
      <div v-if="yearChoices.length > 0" class="flex items-center gap-1.5">
        <USelect
          :model-value="pickedYear"
          :items="yearChoices"
          :placeholder="words.year"
          :aria-label="words.year"
          size="sm"
          class="w-28"
          data-testid="performance-year"
          @update:model-value="pickYear(String($event))"
        />
        <USelect
          v-if="partChoices.length > 0"
          :model-value="periodKey(period)"
          :items="partChoices"
          :aria-label="words.partOfYear"
          size="sm"
          class="w-36"
          data-testid="performance-part"
          @update:model-value="pick(String($event))"
        />
      </div>
    </div>
    <PerformanceNotice :performance="performance" :benchmark="benchmark" />
    <EmptyState
      v-if="performance.kind === 'held-back'"
      icon="i-lucide-chart-spline"
      :title="words.empty.heldBackTitle"
      :description="words.empty.heldBack(heldBackNames)"
      data-testid="performance-held-back"
    />
    <slot v-else-if="figures !== null" :performance="figures" />
  </div>
</template>
