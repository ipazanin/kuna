<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { holdingRecords } from '../domain/holdingRecords'
import { latestRecords } from '../domain/latestRecords'
import { priceHistory } from '../domain/priceHistory'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import HoldingHero from './HoldingHero.vue'
import HoldingIncomeCard from './HoldingIncomeCard.vue'
import HoldingRecordsCard from './HoldingRecordsCard.vue'
import { HOLDINGS_ROUTE, holdingNamed } from './holdingLinks'
import OpenLotsCard from './OpenLotsCard.vue'
import { WORKED_OUT_PRICE_PLACES } from './holdingText'
import { priceChart } from './priceChart'
import { usePortfolio } from './usePortfolio'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatUnitPrice } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** One holding: its value beside its total return, its facts, its price with the average cost and its trades, the lots still held, its transactions and its income. */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const route = useRoute()
const phone = usePhoneLayout()

/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && figures.value === null))
const holding = computed(() => (figures.value === null ? null : holdingNamed(figures.value, route.query.instrument)))
const records = computed(() => (holding.value === null || sources.value === null ? [] : latestRecords(holdingRecords(sources.value.book, holding.value.instrument.id), sources.value.rates)))
const hasIncome = computed(() => records.value.some((entry) => entry.kind === 'income'))
const history = computed(() => (holding.value === null || sources.value === null ? null : priceHistory(holding.value, sources.value)))
const chart = computed(() =>
  history.value === null || holding.value === null ? null : priceChart(history.value, holding.value.averageCost, holding.value.instrument.currency, chartTokens(), phone.value),
)
const legend = computed((): LegendEntry[] => {
  const current = holding.value
  if (current === null || chart.value === null) return []
  const sides = new Set(chart.value.marks.map((mark) => mark.trade.side))
  return [
    { label: words.chart.price, colour: 'var(--invest-portfolio)', mark: 'line' },
    ...(current.averageCost === null
      ? []
      : [{ label: words.chart.averageCost(formatUnitPrice(current.averageCost, current.instrument.currency, WORKED_OUT_PRICE_PLACES)), colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
    ...(sides.has('buy') ? [{ label: words.chart.buy, colour: 'var(--invest-portfolio)', mark: 'dot' as const }] : []),
    ...(sides.has('sell') ? [{ label: words.chart.sale, colour: 'var(--invest-portfolio)', mark: 'ring' as const }] : []),
  ]
})

const description = computed(() => {
  const current = holding.value
  if (current === null || sources.value === null) return ''
  const { instrument } = current
  const accounts = sources.value.book.accounts.filter((account) => (current.units.get(account.id) ?? DECIMAL_ZERO) > DECIMAL_ZERO).map((account) => account.name)
  return [instrument.symbol, instrument.exchange, words.quotedIn(instrument.currency), words.classes[instrument.class], ...accounts].filter((part) => part !== null && part !== '').join(' · ')
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <UButton :to="HOLDINGS_ROUTE" :label="words.allHoldings" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-holdings" />
    <ScreenSkeleton v-if="loading" :cards="2" data-testid="holding-loading" />
    <template v-else-if="holding !== null && sources !== null">
      <PageHeader :title="holding.instrument.name" :description="description" />
      <HoldingHero :holding="holding" :today="sources.today" />
      <ChartCard
        v-if="chart !== null && history !== null"
        :title="words.chart.title"
        :subtitle="words.chart.subtitle(holding.instrument.currency)"
        :option="chart.option"
        :description="chart.description"
        :format-value="chart.formatPrice"
        :empty="history.points.length === 0"
        :empty-title="words.chart.emptyTitle"
        :empty-description="words.chart.emptyDescription"
        :height="280"
        :phone-height="220"
        data-testid="holding-price-chart"
      >
        <template #legend>
          <ChartLegend :entries="legend" />
        </template>
      </ChartCard>
      <DashboardGrid data-testid="holding-cards">
        <OpenLotsCard v-if="holding.lots.length > 0" :holding="holding" :today="sources.today" />
        <HoldingRecordsCard :holding="holding" :records="records" />
        <HoldingIncomeCard v-if="hasIncome" :records="records" />
      </DashboardGrid>
    </template>
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.holding" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="holding-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
