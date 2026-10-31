<script setup lang="ts">
import { computed } from 'vue'

import type { BenchmarkState } from '../domain/benchmark'
import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { words } from './words'
import { formatPercentChange } from '../../../../shared/money/moneyFormat'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'

/** The period's time-weighted return, its money-weighted rate a year, the benchmark's own return and how far apart the two time-weighted figures are. */
const props = defineProps<{
  performance: PeriodPerformance
  benchmark: BenchmarkState
}>()

const text = words.tiles

const timeWeighted = computed(() => {
  const shown = props.performance.portfolio.timeWeighted
  if (shown === null) {
    return { value: text.leftOut, caption: text.belowZeroCaption }
  }
  const { total, yearly } = shown
  return { value: formatPercentChange(total), caption: yearly === null ? text.timeWeightedCaption : text.timeWeightedYearly(formatPercentChange(yearly)) }
})

const moneyWeighted = computed(() => {
  const rate = props.performance.portfolio.moneyWeighted
  switch (rate.kind) {
    case 'rate':
      return { value: formatPercentChange(rate.rate), caption: text.moneyWeightedCaption }
    case 'under-a-year':
      return { value: text.underAYear, caption: text.underAYearCaption }
    case 'none':
      return { value: text.noRate, caption: '' }
  }
})

const compared = computed(() => props.performance.benchmark)
const benchmarkName = computed(() => (props.benchmark.kind === 'none' ? '' : props.benchmark.instrument.name))

const benchmarkTile = computed(() => {
  const comparison = compared.value
  if (comparison === null) {
    switch (props.benchmark.kind) {
      case 'none':
        return { value: text.noBenchmark, caption: text.noBenchmarkCaption }
      case 'no-closes':
        return { value: text.noCloses, caption: benchmarkName.value }
      case 'priced':
        return { value: text.noCloseThen, caption: benchmarkName.value }
    }
  }
  const { total, yearly } = comparison.priceReturn
  return {
    value: formatPercentChange(total),
    caption: yearly === null ? text.benchmarkCaption(benchmarkName.value) : text.benchmarkYearly(benchmarkName.value, formatPercentChange(yearly)),
  }
})

const differenceTile = computed(() => {
  const comparison = compared.value
  if (comparison === null) {
    return { value: text.nothingToCompare, caption: '' }
  }
  if (comparison.difference === null) {
    return props.performance.nothingHeld ? { value: text.nothingHeld, caption: text.nothingHeldCaption } : { value: text.leftOut, caption: text.belowZeroCaption }
  }
  // Level once it rounds to zero at the two decimals of a percent the tile shows.
  const level = Math.round(Math.abs(comparison.difference) * 10_000) === 0
  const caption = level ? text.level(benchmarkName.value) : comparison.difference > 0 ? text.ahead(benchmarkName.value) : text.behind(benchmarkName.value)
  return { value: formatPercentChange(comparison.difference), caption }
})
</script>

<template>
  <DashboardGrid layout="tiles" data-testid="performance-tiles">
    <KpiTile :label="text.timeWeighted" :value="timeWeighted.value" :caption="timeWeighted.caption" :definition="text.timeWeightedDefinition" :to="null" data-testid="performance-time-weighted" />
    <KpiTile :label="text.moneyWeighted" :value="moneyWeighted.value" :caption="moneyWeighted.caption" :definition="text.moneyWeightedDefinition" :to="null" data-testid="performance-money-weighted" />
    <KpiTile
      :label="text.benchmark"
      :value="benchmarkTile.value"
      :caption="benchmarkTile.caption"
      :definition="text.benchmarkDefinition"
      :to="benchmark.kind === 'none' ? INVESTMENTS_SETTINGS_ROUTE : null"
      data-testid="performance-benchmark"
    />
    <KpiTile :label="text.difference" :value="differenceTile.value" :caption="differenceTile.caption" :definition="text.differenceDefinition" :to="null" data-testid="performance-difference" />
  </DashboardGrid>
</template>
