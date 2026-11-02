<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { growthChart } from './growthChart'
import { words } from './words'
import { comparedLegend } from '../../compare/presentation/comparedSeries'
import CompareWith from '../../compare/presentation/CompareWith.vue'
import { useComparison } from '../../compare/presentation/useComparison'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { dayOfCategory } from '../../../../shared/charts/dayAxis'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/**
 * €100 on the period's first day grown at the portfolio's time-weighted return, beside the benchmark's own price on one
 * axis, or with a ticker compared, both as change since the first day.
 */
const props = defineProps<{
  performance: PeriodPerformance
  /** The benchmark's name while the figures compare with it. */
  benchmarkName: string | null
}>()

const phone = usePhoneLayout()
const comparison = useComparison(() => props.performance.growth.map((point) => point.date), 'in-euros')
const benchmark = computed(() => (props.performance.benchmark === null ? null : props.benchmarkName))
const chart = computed(() => growthChart(props.performance.growth, benchmark.value, chartTokens(), phone.value, comparison.line.value))
const legend = computed((): LegendEntry[] => {
  const compared = comparison.line.value
  return [
    { label: words.growth.portfolio, colour: 'var(--invest-portfolio)', mark: 'line' },
    ...(compared !== null ? [comparedLegend(compared)] : benchmark.value === null ? [] : [{ label: benchmark.value, colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
  ]
})
</script>

<template>
  <ChartCard
    :title="chart.title"
    :subtitle="chart.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="performance.growth.length < 2"
    :empty-title="performance.belowZeroOn === null ? words.growth.emptyTitle : words.growth.belowZeroTitle"
    :empty-description="performance.belowZeroOn === null ? words.growth.emptyDescription : words.growth.belowZeroDescription"
    :category-label="dayOfCategory"
    :format-value="chart.formatValue"
    :height="300"
    :phone-height="220"
    data-testid="performance-growth"
  >
    <template #legend>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ChartLegend :entries="legend" />
        <CompareWith :symbol="comparison.ticker.value?.symbol ?? null" :fetching="comparison.fetching.value" :note="comparison.note.value" @pick="comparison.pick" @remove="comparison.remove" />
      </div>
    </template>
  </ChartCard>
</template>
