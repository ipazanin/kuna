<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { holdingMix } from '../domain/holdingMix'
import { holdingRecords } from '../domain/holdingRecords'
import { latestRecords } from '../domain/latestRecords'
import { priceHistory } from '../domain/priceHistory'
import CompareWith from '../../compare/presentation/CompareWith.vue'
import { useComparison } from '../../compare/presentation/useComparison'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import HoldingDetailsCard from './HoldingDetailsCard.vue'
import { holdingDetails } from './holdingDetails'
import HoldingHero from './HoldingHero.vue'
import HoldingIncomeCard from './HoldingIncomeCard.vue'
import HoldingRecordsCard from './HoldingRecordsCard.vue'
import InstrumentDialog from './InstrumentDialog.vue'
import { HOLDINGS_ROUTE, holdingNamed } from './holdingLinks'
import { mixDonut } from './mixDonut'
import OpenLotsCard from './OpenLotsCard.vue'
import { seriesKey } from '../../prices/domain/pricesFile'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { usePrices } from '../../prices/presentation/usePrices'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { priceChart } from './priceChart'
import { usePortfolio } from './usePortfolio'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * One holding: its value beside its total return, its facts, its price with the average cost and its trades, or beside
 * a ticker it is compared with, what it is with a fund's mix by sector and by country, the lots still held, its
 * transactions and its income.
 */
const { state } = useInvestmentsBooks()
const { sources, figures, facts } = usePortfolio()
const route = useRoute()
const phone = usePhoneLayout()

/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && hasTransactions(state.workbook.book) && figures.value === null))
const holding = computed(() => (figures.value === null ? null : holdingNamed(figures.value, route.query.instrument)))
const records = computed(() => (holding.value === null || sources.value === null ? [] : latestRecords(holdingRecords(sources.value.book, holding.value.instrument.id), sources.value.rates)))
const hasIncome = computed(() => records.value.some((entry) => entry.kind === 'income'))
const fullHistory = computed(() => (holding.value === null || sources.value === null ? null : priceHistory(holding.value, sources.value)))
const priceRange = useChartRange(
  () => {
    const points = fullHistory.value?.points ?? []
    const [first] = points
    const last = points.at(-1)
    return first === undefined || last === undefined ? null : { from: first.date, to: last.date }
  },
  () => sources.value?.today ?? today(),
)
/** The history over the range picked, its closes and its trades' dots both. */
const history = computed(() => {
  const full = fullHistory.value
  if (full === null) return null
  const kept = priceRange.window.value
  const shown = (date: CivilDate): boolean => kept === null || rangeContains(kept, date)
  return { ...full, points: full.points.filter((point) => shown(point.date)), dots: full.dots.filter((dot) => shown(dot.date)) }
})
const comparison = useComparison(() => history.value?.points.map((point) => point.date) ?? [], 'as-quoted')
const chart = computed(() => (history.value === null || holding.value === null ? null : priceChart(history.value, holding.value, chartTokens(), phone.value, comparison.line.value)))

const prices = usePrices()
/** Where the holding's closes begin after its first buy, because its vendor has none earlier, said once on its chart. */
const pricesFrom = computed(() => {
  const current = holding.value
  if (current === null || current.firstAcquired === null || current.instrument.prices === 'manual') return null
  const firstClose = prices.state.copy?.file.series[seriesKey(current.instrument.prices, current.instrument.sourceSymbol)]?.closes[0]?.[0]
  const vendor = PRICE_VENDORS.find((candidate) => candidate.id === current.instrument.prices)
  return firstClose === undefined || vendor === undefined || firstClose <= current.firstAcquired.date ? null : words.chart.pricesFrom(dayLabel(parseCivilDate(firstClose)!), vendor.name)
})
const chartSubtitle = computed(() => (chart.value === null ? '' : [chart.value.subtitle, pricesFrom.value].filter((part) => part !== null).join(' ')))

const details = computed(() => (holding.value === null || sources.value === null ? null : holdingDetails(holding.value, sources.value.book, facts.value)))
/** A ring per mix the holding spreads over, from the same split as the mixes of Holdings, of this holding alone. */
const rings = computed(() => {
  const current = holding.value
  const book = sources.value?.book
  if (details.value === null || current === null || figures.value === null || book === undefined) return []
  const alone = { ...figures.value, holdings: [current], cash: [] }
  return details.value.rings.map((mix) => ({ mix, donut: mixDonut(holdingMix(alone, book, facts.value, mix), book, null, 'holding') }))
})

const adding = ref(false)
const changing = ref(false)

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
      <PageHeader :title="holding.instrument.name" :description="description">
        <template #actions>
          <UButton :label="words.actions.change" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="holding-change" @click="changing = true" />
          <UButton :label="words.actions.add" icon="i-lucide-plus" data-testid="holding-add-transaction" @click="adding = true" />
        </template>
      </PageHeader>
      <HoldingHero :holding="holding" :today="sources.today" />
      <ChartCard
        v-if="chart !== null && history !== null"
        v-model:range="priceRange.range.value"
        :title="words.chart.title"
        :subtitle="chartSubtitle"
        :option="chart.option"
        :description="chart.description"
        :empty="history.points.length === 0"
        :empty-title="words.chart.emptyTitle"
        :empty-description="words.chart.emptyDescription"
        :height="280"
        :phone-height="220"
        :ranges="priceRange.ranges.value"
        data-testid="holding-price-chart"
      >
        <template #legend>
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <ChartLegend :entries="chart.legend" />
            <CompareWith
              :name="comparison.name.value"
              :fetching="comparison.fetching.value"
              :note="comparison.note.value"
              :reading="comparison.reading"
              @pick="comparison.pick"
              @remove="comparison.remove"
            />
          </div>
        </template>
        <template #table>
          <caption class="sr-only">
            {{
              words.chart.title
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="text-start">
                <span class="sr-only">{{ chart.table.rowHeading }}</span>
              </th>
              <th scope="col" class="text-end">{{ chart.table.lineHeading }}</th>
              <th v-if="chart.table.comparedHeading !== null" scope="col" class="text-end">{{ chart.table.comparedHeading }}</th>
              <th v-if="chart.table.buys" scope="col" class="text-end">{{ words.chart.buy }}</th>
              <th v-if="chart.table.sales" scope="col" class="text-end">{{ words.chart.sale }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in chart.table.rows" :key="row.label">
              <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
              <td class="figure text-end">{{ row.close }}</td>
              <td v-if="chart.table.comparedHeading !== null" class="figure text-end">{{ row.compared }}</td>
              <td v-if="chart.table.buys" class="figure text-end" :class="{ 'text-muted': row.bought === null }">{{ row.bought ?? '–' }}</td>
              <td v-if="chart.table.sales" class="figure text-end" :class="{ 'text-muted': row.sold === null }">{{ row.sold ?? '–' }}</td>
            </tr>
          </tbody>
        </template>
      </ChartCard>
      <DashboardGrid data-testid="holding-cards">
        <HoldingDetailsCard v-if="details !== null" :details="details" @change="changing = true" />
        <DonutCard
          v-for="{ mix, donut } in rings"
          :key="mix"
          :title="words.mixes.titles[mix]"
          :description="donut.description"
          :parts="donut.parts"
          :total="donut.total"
          :total-label="donut.totalLabel"
          :data-mix="mix"
        />
        <OpenLotsCard v-if="holding.lots.length > 0" :holding="holding" :today="sources.today" />
        <HoldingRecordsCard :holding="holding" :records="records" />
        <HoldingIncomeCard v-if="hasIncome" :records="records" />
      </DashboardGrid>
      <InstrumentDialog v-model:open="changing" :instrument="holding.instrument" :book="sources.book" />
      <TransactionDialog v-model:open="adding" :book="sources.book" :editing="null" :start="{ happened: 'buy', instrument: holding.instrument.id }" />
    </template>
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.holding" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="holding-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
