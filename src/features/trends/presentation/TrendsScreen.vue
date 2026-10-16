<script setup lang="ts">
import { computed, ref } from 'vue'

import { monthRange } from '../../../shared/calendar/dateRange'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../shared/charts/chartTokens'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import type { ChartZoomWindow } from '../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../filters/application/filterStore'
import { chartedMonths } from '../../filters/domain/periodPresets'
import { useChartDrill } from '../../filters/presentation/chartDrill'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { monthlyProfitAndLoss } from '../domain/monthlyProfitAndLoss'
import { MONTHLY_NET, profitAndLossChart } from './profitAndLossChart'
import { cumulativeNetChart, rollingNetChart } from './trendCharts'

const ledger = useFilteredLedger()
const { filters, setFilters } = useFilters()
const openChartDrill = useChartDrill()

const hidden = ref<string[]>([])

const LEGEND = [
  { label: 'Income', colour: 'var(--bucket-income)' },
  { label: 'Operating', colour: 'var(--bucket-operating)' },
  { label: 'Taxes', colour: 'var(--bucket-taxes)' },
  { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
  { label: MONTHLY_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const },
]

function toggle(label: string): void {
  hidden.value = hidden.value.includes(label) ? hidden.value.filter((name) => name !== label) : [...hidden.value, label]
}

const trends = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const tokens = chartTokens()
  const series = monthlyProfitAndLoss(current.scoped, current.window)
  const charted = new Set(chartedMonths(current.filters.period, current.window))
  const shown = series.filter((month) => charted.has(month.month))
  const startIndex = Math.max(0, series.findIndex((month) => charted.has(month.month)))
  const endIndex = series.length - 1 - Math.max(0, [...series].reverse().findIndex((month) => charted.has(month.month)))
  const first = shown[0]
  const last = shown[shown.length - 1]
  return {
    series,
    zoom: { startIndex, endIndex },
    range: first === undefined || last === undefined ? 'No months in this period' : `${monthLabel(first.month)} to ${monthLabel(last.month)}`,
    empty: shown.length === 0,
    byMonth: profitAndLossChart(series, tokens, { netLine: MONTHLY_NET, hidden: hidden.value, zoom: { startIndex, endIndex } }),
    cumulative: cumulativeNetChart(shown, tokens),
    rolling: rollingNetChart(shown, tokens),
  }
})

/** The slider is the period: letting go of it sets a custom period over the months it spans. */
function rescope({ startIndex, endIndex }: ChartZoomWindow): void {
  const current = trends.value
  const from = current?.series[startIndex]
  const to = current?.series[endIndex]
  if (current === null || from === undefined || to === undefined) {
    return
  }
  if (startIndex === current.zoom.startIndex && endIndex === current.zoom.endIndex) {
    return
  }
  void setFilters({ ...filters.value, period: { preset: 'custom', range: monthRange(from.month, to.month) } })
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Trends" description="Is it getting better or worse? Drag the slider under the first chart to change the period." />
    <LedgerGate>
      <template v-if="ledger && trends">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

        <ChartCard
          title="Income and costs by month"
          :subtitle="`Every month of the ledger. The slider marks the period: ${trends.range}.`"
          definition="Income above zero, operating cost, taxes and owner pay below it. Click a legend entry to hide or show it, and a bar to open its rows."
          :description="trends.byMonth.description"
          :option="trends.byMonth.option"
          :height="380"
          @select="openChartDrill(trends.byMonth, $event)"
          @zoom="rescope"
        >
          <template #legend>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <ChartLegend :entries="LEGEND" toggleable :hidden="hidden" @toggle="toggle" />
              <ChartLegend :entries="[{ label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' }]" />
            </div>
          </template>
        </ChartCard>

        <div class="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Cumulative net"
            :subtitle="`Running total since the ledger began, shown for ${trends.range}`"
            :description="trends.cumulative.description"
            :option="trends.cumulative.option"
            :empty="trends.empty"
            @select="openChartDrill(trends.cumulative, $event)"
          >
            <template #legend>
              <ChartLegend
                :entries="[
                  { label: 'Cumulative net', colour: 'var(--accent)', mark: 'line' },
                  { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' },
                ]"
              />
            </template>
          </ChartCard>
          <ChartCard
            title="Rolling net"
            subtitle="Average net per month over the 3 and the 12 months up to each month"
            definition="A rolling average only counts complete months, so it starts once enough of them exist and stops before the month in progress."
            :description="trends.rolling.description"
            :option="trends.rolling.option"
            :empty="trends.empty"
            @select="openChartDrill(trends.rolling, $event)"
          >
            <template #legend>
              <ChartLegend
                :entries="[
                  { label: '3-month average', colour: 'var(--chart-ink)', mark: 'line' },
                  { label: '12-month average', colour: 'var(--accent)', mark: 'line' },
                  { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' },
                ]"
              />
            </template>
          </ChartCard>
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
