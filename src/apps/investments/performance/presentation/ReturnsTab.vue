<script setup lang="ts">
import type { BenchmarkState } from '../domain/benchmark'
import type { PeriodPerformance, YearPerformance } from '../domain/portfolioPerformance'
import GrowthCard from './GrowthCard.vue'
import PerformanceTiles from './PerformanceTiles.vue'
import ReplayCard from './ReplayCard.vue'
import YearsCard from './YearsCard.vue'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'

/** The period's returns against the benchmark, its growth line, the same money in the benchmark and each year's returns. */
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
    <DashboardGrid data-testid="performance-cards">
      <GrowthCard :performance="performance" :benchmark-name="benchmarkName" class="xl:col-span-2" />
      <ReplayCard :performance="performance" :benchmark="benchmark" />
      <YearsCard :years="years" :today="today" class="3xl:col-span-3" />
    </DashboardGrid>
  </div>
</template>
