<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodGains } from '../domain/periodGains'
import { driversChart, periodDrivers } from './driversChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import ChartCard from '../../../../shared/ui/ChartCard.vue'

/** What each holding gained in the period, with the cash's currency effect, the income of no holding and the fees. */
const props = defineProps<{
  gains: PeriodGains
}>()

const drivers = computed(() => periodDrivers(props.gains))
const chart = computed(() => driversChart(drivers.value, chartTokens()))
/** A bar a driver, with room for its label. */
const height = computed(() => Math.max(160, 40 + drivers.value.length * 32))

function gain(amount: number): string {
  return formatMoney(amount, 'always')
}
</script>

<template>
  <ChartCard
    :title="words.drivers.title"
    :subtitle="words.drivers.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="drivers.length === 0"
    :empty-title="words.drivers.emptyTitle"
    :empty-description="words.drivers.emptyDescription"
    :format-value="gain"
    :height="height"
    data-testid="performance-drivers"
  />
</template>
