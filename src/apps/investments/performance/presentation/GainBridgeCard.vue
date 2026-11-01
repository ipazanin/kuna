<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodGains } from '../domain/periodGains'
import { gainBridgeChart } from './gainBridgeChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'

/** The value at the period's start and its end as figures, with what was put in and taken out and each source of the gain between them as steps. */
const props = defineProps<{
  gains: PeriodGains
}>()

const chart = computed(() => gainBridgeChart(props.gains, chartTokens()))
const ends = computed(() => [
  { label: words.bridge.start, value: formatMoney(props.gains.start) },
  { label: words.bridge.end, value: formatMoney(props.gains.end) },
])
</script>

<template>
  <ChartCard
    :title="words.bridge.title"
    :subtitle="words.bridge.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="chart.still"
    :empty-title="words.bridge.noStepsTitle"
    :empty-description="words.bridge.noStepsDescription"
    :height="280"
    data-testid="performance-bridge"
  >
    <template #legend>
      <div class="flex flex-col gap-3">
        <FactGrid :facts="ends" data-testid="performance-bridge-ends" />
        <ChartLegend :entries="chart.legend" />
      </div>
    </template>
    <template v-if="gains.tradingFees !== 0" #footer>
      <p class="border-t border-default px-4 py-2 type-caption sm:px-5" data-testid="performance-bridge-fees">{{ words.bridge.tradingFees(formatMoney(gains.tradingFees)) }}</p>
    </template>
  </ChartCard>
</template>
