<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import USelect from '@nuxt/ui/components/Select.vue'

import type { BenchmarkState } from '../domain/benchmark'
import type { PerformancePeriod } from '../domain/performancePeriod'
import type { Performance, PeriodPerformance } from '../domain/portfolioPerformance'
import { words as overviewWords } from '../../overview/presentation/words'
import PerformanceNotice from './PerformanceNotice.vue'
import { periodKey } from './performanceLinks'
import { words } from './words'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { listInWords } from '../../../../shared/text/listInWords'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
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
const phone = usePhoneLayout()

/** A phone offers the calendar years in a dropdown beside the rolling periods, so the row fits one line. */
const buttonChoices = computed(() => props.periods.filter((offered) => !phone.value || offered.kind !== 'year').map(periodChoice))
const yearChoices = computed(() => (phone.value ? props.periods.filter((offered) => offered.kind === 'year').map(periodChoice) : []))
const pickedYear = computed(() => (props.period.kind === 'year' ? periodKey(props.period) : ''))
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
      return overviewWords.value.period[offered.years]
    case 'all':
      return overviewWords.value.period.all
    case 'year':
      return String(offered.year)
  }
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
      <ChoiceButtons :model-value="periodKey(period)" :options="buttonChoices" :label="words.periods" data-testid="performance-periods" @update:model-value="pick" />
      <USelect
        v-if="yearChoices.length > 0"
        :model-value="pickedYear"
        :items="yearChoices"
        :placeholder="words.year"
        :aria-label="words.year"
        size="sm"
        class="w-28"
        data-testid="performance-year"
        @update:model-value="pick(String($event))"
      />
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
