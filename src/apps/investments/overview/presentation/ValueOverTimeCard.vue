<script setup lang="ts">
import { computed } from 'vue'

import { shownValueOverTime } from '../domain/valueOverTime'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PerformancePeriod } from '../../performance/domain/performancePeriod'
import { firstDepositIn } from '../../performance/domain/portfolioPerformance'
import { valueChart } from './valueChart'
import { words } from './words'
import type { ChartRange } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { listInWords } from '../../../../shared/text/listInWords'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'

/** The value at each month end against what was put in less what was taken out, over the period picked. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const PERIODS: Readonly<Record<Exclude<ChartRange, 'next-5y'>, PerformancePeriod>> = {
  '1y': { kind: 'years', years: 1 },
  '3y': { kind: 'years', years: 3 },
  '5y': { kind: 'years', years: 5 },
  all: { kind: 'all' },
}

const phone = usePhoneLayout()
const { ranges, range } = useChartRange(
  () => {
    const first = firstDepositIn(props.sources.book)
    return first === null ? null : { from: first, to: props.sources.today }
  },
  () => props.sources.today,
)

const shown = computed(() => shownValueOverTime(props.sources, range.value === 'next-5y' ? PERIODS.all : PERIODS[range.value]))
const shownRange = computed((): ChartRange => (shown.value.period.kind === 'years' ? `${shown.value.period.years}y` : 'all'))
const over = computed(() => shown.value.over)
const chart = computed(() => valueChart(over.value, chartTokens(), phone.value))
const emptyDescription = computed(() => {
  const names = listInWords(over.value.heldBack.instruments.map((instrument) => instrument.name))
  return names === '' ? words.value.emptyDescription : words.value.emptyHeldBack(names)
})
</script>

<template>
  <ChartCard
    :title="words.value.title"
    :subtitle="words.value.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="over.points.length === 0"
    :empty-title="words.value.emptyTitle"
    :empty-description="emptyDescription"
    :height="300"
    :phone-height="220"
    :ranges="ranges"
    :range="shownRange"
    data-testid="investments-value-chart"
    @update:range="range = $event"
  >
    <template #legend>
      <ChartLegend
        :entries="[
          { label: words.value.value, colour: 'var(--invest-portfolio)', mark: 'line' },
          { label: words.value.putIn, colour: 'var(--invest-reference)', mark: 'dashed' },
        ]"
      />
    </template>
  </ChartCard>
</template>
