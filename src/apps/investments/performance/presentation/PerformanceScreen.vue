<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { benchmarkState, comparedBenchmark } from '../domain/benchmark'
import { performancePeriods } from '../domain/performancePeriod'
import type { PerformancePeriod } from '../domain/performancePeriod'
import { dayValuer, firstDepositIn, performanceByYear, portfolioPerformance } from '../domain/portfolioPerformance'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import ComingTab from '../../income/presentation/ComingTab.vue'
import CostsTab from '../../income/presentation/CostsTab.vue'
import IncomeTab from '../../income/presentation/IncomeTab.vue'
import SavingTab from '../../income/presentation/SavingTab.vue'
import TaxFreeTab from '../../income/presentation/TaxFreeTab.vue'
import WithheldTab from '../../income/presentation/WithheldTab.vue'
import { words as incomeWords } from '../../income/presentation/words'
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
 * where the period's gain came from, how far it fell below its peaks, the income received, coming, turning tax-free
 * and withheld, the costs of each year, and how regularly money went in. Returns, Sources and Falls follow the period picked.
 */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const prices = usePrices()
const route = useRoute()

const TABS: readonly PageTab[] = [
  { value: 'returns', label: words.tabs.returns, icon: 'i-lucide-chart-spline' },
  { value: 'months', label: words.tabs.months, icon: 'i-lucide-grid-3x3' },
  { value: 'sources', label: words.tabs.sources, icon: 'i-lucide-chart-column-stacked' },
  { value: 'falls', label: words.tabs.falls, icon: 'i-lucide-trending-down' },
  { value: 'income', label: incomeWords.tabs.income, icon: 'i-lucide-coins' },
  { value: 'coming', label: incomeWords.tabs.coming, icon: 'i-lucide-calendar-clock' },
  { value: 'tax-free', label: incomeWords.tabs.taxFree, icon: 'i-lucide-calendar-check' },
  { value: 'withheld', label: incomeWords.tabs.withheld, icon: 'i-lucide-landmark' },
  { value: 'costs', label: incomeWords.tabs.costs, icon: 'i-lucide-receipt' },
  { value: 'saving', label: incomeWords.tabs.saving, icon: 'i-lucide-piggy-bank' },
]
/** The income, costs and saving tabs read no period, so the header describes the tab instead of naming the period's days. */
const INCOME_TAB_DESCRIPTIONS: Readonly<Record<string, string>> = {
  income: incomeWords.descriptions.income,
  coming: incomeWords.descriptions.coming,
  'tax-free': incomeWords.descriptions.taxFree,
  withheld: incomeWords.descriptions.withheld,
  costs: incomeWords.descriptions.costs,
  saving: incomeWords.descriptions.saving,
}

/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && figures.value === null))

/** Months shows every month since the first deposit, whatever the period picked. */
const ALL: PerformancePeriod = { kind: 'all' }

const firstDeposit = computed(() => (sources.value === null ? null : firstDepositIn(sources.value.book)))
/** Every period starts at the first deposit, so a file with none, or with one still to come, has nothing to measure. */
const started = computed(() => sources.value !== null && firstDeposit.value !== null && firstDeposit.value <= sources.value.today)
const periods = computed(() => (sources.value === null ? [] : performancePeriods(firstDeposit.value, sources.value.today)))
const period = computed(() => periodNamed(periods.value, route.query.period))
const onMonths = computed(() => route.query.tab === 'months')

const benchmark = computed(() => (sources.value === null ? null : benchmarkState(sources.value)))
const compared = computed(() => (benchmark.value === null || sources.value === null ? null : comparedBenchmark(benchmark.value, sources.value.book, prices.state.copy?.file.splits ?? [])))
/**
 * Each day is valued once for the sources on screen, so the years and the months reuse the days of All and a switch of period reuses them all.
 * Only the open tab reads the figures, so an income tab never waits for them.
 */
const valuedOn = computed(() => (sources.value === null ? null : dayValuer(sources.value)))
const performance = computed(() => (sources.value === null || valuedOn.value === null ? null : portfolioPerformance(sources.value, compared.value, period.value, valuedOn.value)))
const everything = computed(() =>
  period.value.kind === 'all' ? performance.value : sources.value === null || valuedOn.value === null ? null : portfolioPerformance(sources.value, compared.value, ALL, valuedOn.value),
)
const years = computed(() => (sources.value === null || valuedOn.value === null ? [] : performanceByYear(sources.value, compared.value, valuedOn.value)))

/** The span of the figures on screen: everything on Months, the period picked on the other tabs that follow it. */
const description = computed(() => {
  const tabDescription = started.value ? INCOME_TAB_DESCRIPTIONS[String(route.query.tab)] : undefined
  if (tabDescription !== undefined) {
    return tabDescription
  }
  const shown = onMonths.value ? everything.value : performance.value
  return shown?.kind !== 'figures' ? words.description : words.span(dayLabel(shown.from), dayLabel(shown.to))
})
const benchmarkName = computed(() => compared.value?.instrument.name ?? null)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="performance-loading" />
    <template v-else-if="sources !== null && benchmark !== null && valuedOn !== null">
      <EmptyState v-if="!started" icon="i-lucide-chart-spline" :title="words.empty.title" :description="words.empty.description" data-testid="performance-empty" />
      <PageTabs v-else :tabs="TABS" :label="words.tabs.label" data-testid="performance-tabs">
        <template #returns>
          <PeriodPanel v-if="performance !== null" v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <ReturnsTab :performance="shown" :benchmark="benchmark" :benchmark-name="shown.benchmark === null ? null : benchmarkName" :years="years" :today="sources.today" />
          </PeriodPanel>
        </template>
        <template #months>
          <PeriodPanel v-if="everything !== null" v-slot="{ performance: shown }" :periods="[]" :period="ALL" :performance="everything" :benchmark="benchmark">
            <ReturnHeatmap :performance="shown" :benchmark-name="shown.benchmark === null ? null : benchmarkName" :benchmark-chosen="benchmark.kind !== 'none'" />
          </PeriodPanel>
        </template>
        <template #sources>
          <PeriodPanel v-if="performance !== null" v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <SourcesTab :sources="sources" :performance="shown" :valued-on="valuedOn" />
          </PeriodPanel>
        </template>
        <template #falls>
          <PeriodPanel v-if="performance !== null" v-slot="{ performance: shown }" :periods="periods" :period="period" :performance="performance" :benchmark="benchmark">
            <FallsTab :performance="shown" />
          </PeriodPanel>
        </template>
        <template #income><IncomeTab :sources="sources" /></template>
        <template #coming><ComingTab :sources="sources" /></template>
        <template #tax-free><TaxFreeTab v-if="figures !== null" :figures="figures" :today="sources.today" /></template>
        <template #withheld><WithheldTab :sources="sources" /></template>
        <template #costs><CostsTab :sources="sources" :valued-on="valuedOn" /></template>
        <template #saving><SavingTab v-if="figures !== null" :sources="sources" :value="figures.value" /></template>
      </PageTabs>
    </template>
  </section>
</template>
