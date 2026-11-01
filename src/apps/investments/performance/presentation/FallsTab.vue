<script setup lang="ts">
import type { PeriodPerformance } from '../domain/portfolioPerformance'
import RiskCard from './RiskCard.vue'
import UnderwaterCard from './UnderwaterCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'

/** How far the period's return fell below its peaks, beside its largest fall and its volatility. */
defineProps<{
  performance: PeriodPerformance
}>()
</script>

<template>
  <DashboardGrid data-testid="performance-falls">
    <UnderwaterCard :performance="performance" />
    <RiskCard :performance="performance" />
  </DashboardGrid>
</template>
