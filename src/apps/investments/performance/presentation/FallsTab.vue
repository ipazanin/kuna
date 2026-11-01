<script setup lang="ts">
import type { PeriodPerformance } from '../domain/portfolioPerformance'
import RiskCard from './RiskCard.vue'
import UnderwaterCard from './UnderwaterCard.vue'

/** How far the period's return fell below its peaks across the full row, with its largest fall and its volatility below it. */
defineProps<{
  performance: PeriodPerformance
}>()
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="performance-falls">
    <UnderwaterCard :performance="performance" />
    <RiskCard :performance="performance" />
  </div>
</template>
