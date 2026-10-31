<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { benchmarkState, comparedBenchmark } from '../domain/benchmark'
import { performancePeriods } from '../domain/performancePeriod'
import type { PerformancePeriod } from '../domain/performancePeriod'
import { dayValuer, firstDepositIn, performanceByYear, portfolioPerformance } from '../domain/portfolioPerformance'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { usePrices } from '../../prices/presentation/usePrices'
import { words as overviewWords } from '../../overview/presentation/words'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import GrowthCard from './GrowthCard.vue'
import PerformanceNotice from './PerformanceNotice.vue'
import PerformanceTiles from './PerformanceTiles.vue'
import { periodKey, periodNamed } from './performanceLinks'
import ReplayCard from './ReplayCard.vue'
import RiskCard from './RiskCard.vue'
import { words } from './words'
import YearsCard from './YearsCard.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { listInWords } from '../../../../shared/text/listInWords'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** How the portfolio grew over the period picked, time-weighted and money-weighted, against the benchmark, with each year's returns, its largest fall and its volatility. */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const prices = usePrices()
const route = useRoute()
const router = useRouter()

/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && figures.value === null))

const periods = computed(() => (sources.value === null ? [] : performancePeriods(firstDepositIn(sources.value.book), sources.value.today)))
const period = computed(() => periodNamed(periods.value, route.query.period))
const periodChoices = computed(() => periods.value.map((offered) => ({ value: periodKey(offered), label: periodLabel(offered) })))

const benchmark = computed(() => (sources.value === null ? null : benchmarkState(sources.value)))
const compared = computed(() => (benchmark.value === null || sources.value === null ? null : comparedBenchmark(benchmark.value, sources.value.book, prices.state.copy?.file.splits ?? [])))
/** Each day is valued once for the sources on screen, so the years reuse the days of All and a switch of period reuses both. */
const valuedOn = computed(() => (sources.value === null ? null : dayValuer(sources.value)))
const performance = computed(() => (sources.value === null || valuedOn.value === null ? null : portfolioPerformance(sources.value, compared.value, period.value, valuedOn.value)))
const years = computed(() => (sources.value === null || valuedOn.value === null ? [] : performanceByYear(sources.value, compared.value, valuedOn.value)))
const figuresOfPeriod = computed(() => (performance.value?.kind === 'figures' ? performance.value : null))

const description = computed(() => (figuresOfPeriod.value === null ? words.description : words.span(dayLabel(figuresOfPeriod.value.from), dayLabel(figuresOfPeriod.value.to))))
const heldBackNames = computed(() => {
  const shown = performance.value
  return shown?.kind === 'held-back' ? listInWords([...shown.heldBack.instruments.map((instrument) => instrument.name), ...shown.heldBack.currencies]) : ''
})

function periodLabel(offered: PerformancePeriod): string {
  switch (offered.kind) {
    case 'years':
      return overviewWords.value.period[offered.years]
    case 'all':
      return overviewWords.value.period.all
    case 'year':
      return String(offered.year)
  }
}

/** All, the period the screen opens on, stays out of the address. */
function pick(key: string): void {
  const { period: _left, ...others } = route.query
  void router.replace({ query: key === 'all' ? others : { ...others, period: key } })
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="performance-loading" />
    <template v-else-if="sources !== null && performance !== null && benchmark !== null">
      <EmptyState v-if="performance.kind === 'empty'" icon="i-lucide-chart-spline" :title="words.empty.title" :description="words.empty.description" data-testid="performance-empty" />
      <template v-else>
        <ChoiceButtons v-if="periods.length > 1" :model-value="periodKey(period)" :options="periodChoices" :label="words.periods" data-testid="performance-periods" @update:model-value="pick" />
        <PerformanceNotice :performance="performance" :benchmark="benchmark" />
        <EmptyState
          v-if="performance.kind === 'held-back'"
          icon="i-lucide-chart-spline"
          :title="words.empty.heldBackTitle"
          :description="words.empty.heldBack(heldBackNames)"
          data-testid="performance-held-back"
        />
        <template v-else-if="figuresOfPeriod !== null">
          <PerformanceTiles :performance="figuresOfPeriod" :benchmark="benchmark" />
          <DashboardGrid data-testid="performance-cards">
            <GrowthCard :performance="figuresOfPeriod" :benchmark-name="compared?.instrument.name ?? null" class="xl:col-span-2 3xl:col-span-1" />
            <ReplayCard :performance="figuresOfPeriod" :benchmark="benchmark" />
            <RiskCard :performance="figuresOfPeriod" />
            <YearsCard :years="years" :today="sources.today" class="xl:col-span-2 3xl:col-span-3" />
          </DashboardGrid>
        </template>
      </template>
    </template>
  </section>
</template>
