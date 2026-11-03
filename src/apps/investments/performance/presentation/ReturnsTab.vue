<script setup lang="ts">
import type { BenchmarkState } from '../domain/benchmark'
import type { PeriodPerformance, YearPerformance } from '../domain/portfolioPerformance'
import GrowthCard from './GrowthCard.vue'
import PerformanceTiles from './PerformanceTiles.vue'
import YearsCard from './YearsCard.vue'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/**
 * The period's returns against the benchmark, its growth line with the same money in the benchmark under it, and each
 * year's returns. Both cards take the full width, one above the other.
 */
defineProps<{
  performance: PeriodPerformance
  benchmark: BenchmarkState
  /** The benchmark's name while the figures compare with it. */
  benchmarkName: string | null
  years: readonly YearPerformance[]
  today: CivilDate
}>()
</script>

<template>
  <div class="flex flex-col gap-6">
    <PerformanceTiles :performance="performance" :benchmark="benchmark" />
    <GrowthCard :performance="performance" :benchmark-name="benchmarkName" />
    <YearsCard :years="years" :today="today" />
  </div>
</template>
