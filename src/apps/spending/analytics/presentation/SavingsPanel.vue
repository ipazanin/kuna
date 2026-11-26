<script setup lang="ts">
import { computed } from 'vue'

import { keptMoneyChart } from './keptMoneyChart'
import { monthFlowChart } from './monthFlowChart'
import MonthFlowCard from './MonthFlowCard.vue'
import TrendsCard from './TrendsCard.vue'
import { words } from './words'
import { keptOver } from '../domain/keptMoney'
import { monthFlow, savingsRateOver } from '../domain/monthFlow'
import type { SpendingFigures } from '../domain/spendingFigures'
import { entriesLink } from '../../overview/presentation/spendingLinks'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { words as rateWords } from '../../rates/presentation/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthRange } from '../../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { monthsFrom } from '../../../../shared/calendar/monthKey'
import { monthRangeLabel } from '../../../../shared/calendar/monthLabel'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { formatMoney, formatPercent, percentAsShown } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { moneyToneClass } from '../../../../shared/ui/moneyTone'

/**
 * How much of the money in stays, as Overview's savings rate counts it, each month and over an average month, what the kept
 * money became, and the categories that grow or shrink.
 */
const props = defineProps<{
  figures: SpendingFigures
  window: LedgerWindow
  waiting: boolean
  day: CivilDate
}>()

const chartRange = useChartRange(
  () => wholeMonthsSpan(props.window.firstMonth, props.window.partMonth),
  () => props.day,
)
const months = computed(() => monthsFrom(props.window.firstMonth, props.window.partMonth).filter((month) => monthInRange(chartRange.window.value, month)))
const tokens = computed(() => chartTokens())
const flowChart = computed(() => monthFlowChart(monthFlow(months.value.map((month) => props.figures.totalsOf(month))), props.window.partMonth, tokens.value))
const kept = computed(() => props.figures.keptIn(months.value))
const keptChart = computed(() => keptMoneyChart(kept.value, props.window.partMonth, tokens.value))

/** The whole months an average month reads, the last twelve or as many as the book has. */
const averaged = computed(() => props.figures.averageOf(null, props.day).months.map((counted) => counted.month))
const averagedTotals = computed(() => averaged.value.map((month) => props.figures.totalsOf(month)))
const rate = computed(() => savingsRateOver(averagedTotals.value))
const rateInWords = computed(() => {
  if (props.waiting) return rateWords.loading
  return averaged.value.length === 0 ? words.analysis.overTime.noAverage : words.analysis.savings.noIncome
})
const keptTogether = computed(() => keptOver(props.figures.keptIn(averaged.value)))
const averagedLink = computed(() => {
  const first = averaged.value[0]
  const last = averaged.value.at(-1)
  return first === undefined || last === undefined ? null : entriesLink(monthRange(first, last))
})
const wentSubtitle = computed(() => {
  const first = months.value[0]
  const last = months.value.at(-1)
  if (first === undefined || last === undefined) return undefined
  return words.analysis.savings.wentSubtitle(monthRangeLabel(first, last))
})
const caption = computed(() => (averaged.value.length === 0 ? undefined : plural(words.analysis.overTime.averageCaption(averaged.value.length), averaged.value.length)))
const trends = computed(() => props.figures.trendsOn(props.day))
const steady = computed(() => trends.value.filter((trend) => trend.trend === 'steady').length)
const unrated = computed(() => (props.waiting ? null : unratedNote(kept.value.reduce((count, month) => count + month.unrated, 0))))
</script>

<template>
  <div class="flex flex-col gap-6">
    <DashboardGrid layout="tiles" data-testid="spending-analysis-savings-tiles">
      <KpiTile
        :label="words.analysis.savings.rate"
        :value="rate === null ? rateInWords : formatPercent(rate, 'always')"
        v-bind="caption === undefined ? {} : { caption }"
        :to="averagedLink"
        data-testid="spending-analysis-savings-rate"
      >
        <template #value>
          <span v-if="waiting || rate === null" class="block type-body font-normal">{{ rateInWords }}</span>
          <span v-else class="figure" :class="moneyToneClass(percentAsShown(rate), 'outcome')">{{ formatPercent(rate, 'always') }}</span>
        </template>
      </KpiTile>
      <KpiTile
        :label="words.analysis.savings.kept"
        :value="averaged.length === 0 ? words.analysis.overTime.noAverage : formatMoney(keptTogether.kept, 'always')"
        v-bind="caption === undefined ? {} : { caption }"
        :to="averagedLink"
        data-testid="spending-analysis-kept"
      >
        <template #value>
          <span v-if="waiting || averaged.length === 0" class="block type-body font-normal">{{ waiting ? rateWords.loading : words.analysis.overTime.noAverage }}</span>
          <MoneyText v-else :cents="keptTogether.kept" tone="outcome" />
        </template>
      </KpiTile>
    </DashboardGrid>
    <DashboardGrid>
      <MonthFlowCard
        :range-choice="chartRange"
        :title="words.analysis.savings.flowTitle"
        v-bind="unrated === null ? {} : { subtitle: unrated }"
        :chart="flowChart"
        :loading="waiting"
        data-testid="spending-analysis-flow"
      />
      <ChartCard
        :title="words.analysis.savings.wentTitle"
        v-bind="wentSubtitle === undefined ? {} : { subtitle: wentSubtitle }"
        :description="keptChart.description"
        :option="keptChart.option"
        :loading="waiting"
        :empty="keptChart.legend.length === 0"
        :height="300"
        :phone-height="260"
        data-testid="spending-analysis-went"
      >
        <template #legend><ChartLegend :entries="keptChart.legend" /></template>
      </ChartCard>
    </DashboardGrid>
    <DashboardGrid v-if="trends.length > 0" data-testid="spending-analysis-trends">
      <TrendsCard :trends="trends" trend="growing" />
      <TrendsCard :trends="trends" trend="shrinking" />
    </DashboardGrid>
    <p v-if="trends.length === 0" class="type-aside" data-testid="spending-analysis-no-trends">{{ words.analysis.savings.noTrends }}</p>
    <p v-else-if="steady > 0" class="type-caption" data-testid="spending-analysis-steady">{{ plural(words.analysis.savings.steady(steady), steady) }}</p>
  </div>
</template>
