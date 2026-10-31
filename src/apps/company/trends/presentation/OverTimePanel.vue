<script setup lang="ts">
import { computed, ref } from 'vue'

import { monthRange } from '../../../../shared/calendar/dateRange'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import type { ChartZoomWindow } from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { useFilters } from '../../filters/application/filterStore'
import { periodMonths } from '../../filters/domain/periodPresets'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence } from '../../settings/domain/profitAndLossLabels'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../domain/monthlyProfitAndLoss'
import { MONTHLY_NET, profitAndLossChart, profitAndLossLegend, profitAndLossSeries } from './profitAndLossChart'
import { cumulativeNetChart, rollingNetChart } from './trendCharts'
import { words } from './words'

/** Is it getting better or worse: every month of the ledger, with the period marked on the slider. */
const ledger = useFilteredLedger()
const settings = useSettings()
const { filters, setFilters } = useFilters()

const hidden = ref<string[]>([])

const series = computed(() => profitAndLossSeries(settings.value))
const legend = computed(() => [...profitAndLossLegend(series.value), { label: MONTHLY_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const }])

function toggle(label: string): void {
  hidden.value = hidden.value.includes(label) ? hidden.value.filter((name) => name !== label) : [...hidden.value, label]
}

const trends = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const tokens = chartTokens()
  const months = monthlyProfitAndLoss(current.profitAndLossRows, current.window)
  const charted = new Set(periodMonths(current.filters.period, current.window))
  const shown = months.filter((month) => charted.has(month.month))
  const startIndex = Math.max(
    0,
    months.findIndex((month) => charted.has(month.month)),
  )
  const endIndex =
    months.length -
    1 -
    Math.max(
      0,
      [...months].reverse().findIndex((month) => charted.has(month.month)),
    )
  const last = shown[shown.length - 1]
  return {
    months,
    income: settings.value.bucketLabels.income,
    costs: costLabelsInSentence(settings.value),
    zoom: { startIndex, endIndex },
    empty: shown.length === 0,
    byMonth: profitAndLossChart(months, tokens, { series: series.value, netLine: MONTHLY_NET, hidden: hidden.value, zoom: { startIndex, endIndex } }),
    cumulative: cumulativeNetChart(shown, tokens),
    cumulativeSummary: last === undefined ? words.overTime.noMonthsInPeriod : words.overTime.cumulativeSummary(formatMoney(last.cumulativeNet), monthLabel(last.month)),
    rolling: rollingNetChart(shown, tokens),
  }
})

/** The slider is the period: letting go of it sets a custom period over the months it spans. */
function rescope({ startIndex, endIndex }: ChartZoomWindow): void {
  const current = trends.value
  const from = current?.months[startIndex]
  const to = current?.months[endIndex]
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
  <div v-if="trends" class="flex flex-col gap-6">
    <DrillChartCard
      :chart="trends.byMonth"
      :title="words.overTime.byMonth"
      :subtitle="words.overTime.byMonthSubtitle"
      :definition="words.overTime.byMonthDefinition(trends.income, trends.costs)"
      :height="380"
      :phone-height="300"
      @zoom="rescope"
    >
      <template #legend>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <ChartLegend :entries="legend" toggleable :hidden="hidden" @toggle="toggle" />
          <ChartLegend :entries="[{ label: words.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' }]" />
        </div>
      </template>
    </DrillChartCard>

    <DrillChartCard :chart="trends.rolling" :title="words.overTime.rolling" :subtitle="words.overTime.rollingSubtitle" :definition="words.overTime.rollingDefinition" :empty="trends.empty">
      <template #legend>
        <ChartLegend
          :entries="[
            { label: words.average3, colour: 'var(--chart-ink)', mark: 'line' },
            { label: words.average12, colour: 'var(--accent)', mark: 'line' },
            { label: words.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' },
          ]"
        />
      </template>
    </DrillChartCard>

    <DrillChartCard
      :chart="trends.cumulative"
      :title="words.cumulativeNet"
      :subtitle="words.overTime.cumulativeSubtitle"
      :empty="trends.empty"
      collapse-id="analysis.cumulative"
      :summary="trends.cumulativeSummary"
      start-collapsed
    >
      <template #legend>
        <ChartLegend
          :entries="[
            { label: words.cumulativeNet, colour: 'var(--accent)', mark: 'line' },
            { label: words.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' },
          ]"
        />
      </template>
    </DrillChartCard>
  </div>
</template>
