<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodGains } from '../domain/periodGains'
import { gainBridgeChart } from './gainBridgeChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'

/** The value at the period's start, what was put in and taken out, each source of the gain, and the value at its end. */
const props = defineProps<{
  gains: PeriodGains
}>()

const chart = computed(() => gainBridgeChart(props.gains, chartTokens()))
</script>

<template>
  <ChartCard :title="words.bridge.title" :subtitle="words.bridge.subtitle" :option="chart.option" :description="chart.description" :height="320" data-testid="performance-bridge">
    <template #legend>
      <ChartLegend :entries="chart.legend" />
    </template>
    <template v-if="gains.tradingFees !== 0" #footer>
      <p class="border-t border-default px-4 py-2 type-caption sm:px-5" data-testid="performance-bridge-fees">{{ words.bridge.tradingFees(formatMoney(gains.tradingFees)) }}</p>
    </template>
  </ChartCard>
</template>
