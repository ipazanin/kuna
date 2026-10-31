<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { dayOfCategory, growthChart } from './growthChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** €100 on the period's first day grown at the portfolio's time-weighted return, beside the benchmark's own price on one axis. */
const props = defineProps<{
  performance: PeriodPerformance
  /** The benchmark's name while the figures compare with it. */
  benchmarkName: string | null
}>()

const phone = usePhoneLayout()
const compared = computed(() => (props.performance.benchmark === null ? null : props.benchmarkName))
const chart = computed(() => growthChart(props.performance.growth, compared.value, chartTokens(), phone.value))
const legend = computed((): LegendEntry[] => [
  { label: words.growth.portfolio, colour: 'var(--invest-portfolio)', mark: 'line' },
  ...(compared.value === null ? [] : [{ label: compared.value, colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
])
</script>

<template>
  <ChartCard
    :title="words.growth.title(chart.start)"
    :subtitle="words.growth.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="performance.growth.length < 2"
    :empty-title="performance.belowZeroOn === null ? words.growth.emptyTitle : words.growth.belowZeroTitle"
    :empty-description="performance.belowZeroOn === null ? words.growth.emptyDescription : words.growth.belowZeroDescription"
    :category-label="dayOfCategory"
    :height="300"
    :phone-height="220"
    data-testid="performance-growth"
  >
    <template #legend>
      <ChartLegend :entries="legend" />
    </template>
  </ChartCard>
</template>
