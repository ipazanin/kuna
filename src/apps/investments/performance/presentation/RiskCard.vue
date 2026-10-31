<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { words } from './words'
import { formatPercent, formatPercentChange } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** The deepest fall of the period's time-weighted return from a running peak, and how much its monthly returns swung. */
const props = defineProps<{
  performance: PeriodPerformance
}>()

const text = words.risk

const facts = computed((): Fact[] => {
  const { largestFall, volatility, belowZeroOn } = props.performance
  const leftOut = belowZeroOn !== null
  return [
    largestFall === null
      ? { label: text.largestFall, value: '–', caption: leftOut ? text.leftOut : text.noFall }
      : { label: text.largestFall, value: formatPercentChange(largestFall), caption: text.largestFallCaption },
    volatility === null
      ? { label: text.volatility, value: '–', caption: leftOut ? text.leftOut : text.noVolatility }
      : { label: text.volatility, value: formatPercent(volatility), caption: text.volatilityCaption },
  ]
})
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" data-testid="performance-risk">
    <div class="px-4 pt-1 pb-4 sm:px-5">
      <FactGrid :facts="facts" />
    </div>
  </AppCard>
</template>
