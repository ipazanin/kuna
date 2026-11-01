<script setup lang="ts">
import { computed } from 'vue'

import { periodGains } from '../domain/periodGains'
import type { DayValuer, PeriodPerformance } from '../domain/portfolioPerformance'
import type { PortfolioSources } from '../../holdings/domain/holding'
import CurrencyEffectCard from './CurrencyEffectCard.vue'
import DriversCard from './DriversCard.vue'
import GainBridgeCard from './GainBridgeCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'

/** Where the period's gain came from: the bridge from the start's value to the end's, the holdings that drove it and what the rates did. */
const props = defineProps<{
  sources: PortfolioSources
  performance: PeriodPerformance
  valuedOn: DayValuer
}>()

const gains = computed(() => periodGains(props.sources, props.performance, props.valuedOn))
</script>

<template>
  <DashboardGrid data-testid="performance-sources">
    <GainBridgeCard :gains="gains" />
    <DriversCard :gains="gains" />
    <CurrencyEffectCard :gains="gains" class="xl:col-span-2 3xl:col-span-1" />
  </DashboardGrid>
</template>
