<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { benchmarkState, comparedBenchmark } from '../domain/benchmark'
import { performancePeriods } from '../domain/performancePeriod'
import type { PerformancePeriod } from '../domain/performancePeriod'
import { dayValuer, firstDepositIn, performanceByYear, portfolioPerformance } from '../domain/portfolioPerformance'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { usePrices } from '../../prices/presentation/usePrices'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import FallsTab from './FallsTab.vue'
import { periodNamed } from './performanceLinks'
import PeriodPanel from './PeriodPanel.vue'
import ReturnHeatmap from './ReturnHeatmap.vue'
import ReturnsTab from './ReturnsTab.vue'
import SourcesTab from './SourcesTab.vue'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * How the portfolio grew, in tabs: the period's returns against the benchmark, every month since the first deposit,
 * where the period's gain came from, and how far it fell below its peaks. Every tab but Months follows the period picked.
 */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const prices = usePrices()
const route = useRoute()

const TABS: readonly PageTab[] = [
  { value: 'returns', label: words.tabs.returns },
  { value: 'months', label: words.tabs.months },
  { value: 'sources', label: words.tabs.sources },
  { value: 'falls', label: words.tabs.falls },
]

/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && figures.value === null))

/** Months shows every month since the first deposit, whatever the period picked. */
const ALL: PerformancePeriod = { kind: 'all' }

const periods = computed(() => (sources.value === null ? [] : performancePeriods(firstDepositIn(sources.value.book), sources.value.today)))
const period = computed(() => periodNamed(periods.value, route.query.period))
const onMonths = computed(() => route.query.tab === 'months')

const benchmark = computed(() => (sources.value === null ? null : benchmarkState(sources.value)))
const compared = computed(() => (benchmark.value === null || sources.value === null ? null : comparedBenchmark(benchmark.value, sources.value.book, prices.state.copy?.file.splits ?? [])))
/** Each day is valued once for the sources on screen, so the years and the months reuse the days of All and a switch of period reuses them all. */
const valuedOn = computed(() => (sources.value === null ? null : dayValuer(sources.value)))
const performance = computed(() => (sources.value === null || valuedOn.value === null ? null : portfolioPerformance(sources.value, compared.value, period.value, valuedOn.value)))
const everything = computed(() =>
  period.value.kind === 'all' ? performance.value : sources.value === null || valuedOn.value === null ? null : portfolioPerformance(sources.value, compared.value, ALL, valuedOn.value),
)
const years = computed(() => (sources.value === null || valuedOn.value === null ? [] : performanceByYear(sources.value, compared.value, valuedOn.value)))

/** The span of the figures on screen: everything on Months, else the period picked. */
const description = computed(() => {
  const shown = onMonths.value ? everything.value : performance.value
  return shown?.kind !== 'figures' ? words.description : words.span(dayLabel(shown.from), dayLabel(shown.to))
})
const benchmarkName = computed(() => compared.value?.instrument.name ?? null)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="performance-loading" />
    <template v-else-if="sources !== null && performance !== null && everything !== null && benchmark !== null && valuedOn !== null">
      <EmptyState v-if="performance.kind === 'empty'" icon="i-lucide-chart-spline" :title="words.empty.title" :description="words.empty.description" data-testid="performance-empty" />
      <PageTabs v-else :tabs="TABS" :label="words.tabs.label" data-testid="performance-tabs">
        <template #returns>
          <PeriodPanel v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <ReturnsTab :performance="shown" :benchmark="benchmark" :benchmark-name="shown.benchmark === null ? null : benchmarkName" :years="years" :today="sources.today" />
          </PeriodPanel>
        </template>
        <template #months>
          <PeriodPanel v-slot="{ performance: shown }" :periods="[]" :period="ALL" :performance="everything" :benchmark="benchmark">
            <ReturnHeatmap :performance="shown" :benchmark-name="shown.benchmark === null ? null : benchmarkName" :benchmark-chosen="benchmark.kind !== 'none'" />
          </PeriodPanel>
        </template>
        <template #sources>
          <PeriodPanel v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <SourcesTab :sources="sources" :performance="shown" :valued-on="valuedOn" />
          </PeriodPanel>
        </template>
        <template #falls>
          <PeriodPanel v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <FallsTab :performance="shown" />
          </PeriodPanel>
        </template>
      </PageTabs>
    </template>
  </section>
</template>
