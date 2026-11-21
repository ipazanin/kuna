<script setup lang="ts">
import { computed } from 'vue'

import AnalysisCategoryField from './AnalysisCategoryField.vue'
import { categoryMonthsChart } from './categoryMonthsChart'
import { useAnalysisCategory } from './useAnalysisCategory'
import { words } from './words'
import { categoryMonths } from '../domain/categoryMonths'
import type { SpendingFigures } from '../domain/spendingFigures'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { entriesLink, transactionsLink } from '../../overview/presentation/spendingLinks'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { words as rateWords } from '../../rates/presentation/words'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthRange } from '../../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { monthsFrom } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** One category's months side by side with the average month across them, and the average month beside this month so far. */
const props = defineProps<{
  book: SpendingBook
  figures: SpendingFigures
  window: LedgerWindow
  waiting: boolean
  day: CivilDate
}>()

const category = useAnalysisCategory(() => props.book.categories)
const name = computed(() => category.value?.name ?? words.analysis.overTime.allSpending)
const colourToken = computed(() => (category.value === null ? '--chart-ink-muted' : categoryColours(props.book.categories)(category.value)))
/** Money in on an income category, money out on any other. */
const shownAsFlow = (amount: Money): Money => (category.value?.kind === 'income' ? amount : negateMoney(amount))

const chartRange = useChartRange(
  () => wholeMonthsSpan(props.window.firstMonth, props.window.partMonth),
  () => props.day,
)
const months = computed(() => monthsFrom(props.window.firstMonth, props.window.partMonth).filter((month) => monthInRange(chartRange.window.value, month)))
const counted = computed(() => categoryMonths(props.figures.totalsOf, category.value, months.value))
const average = computed(() => props.figures.averageOf(category.value, props.day))
const chart = computed(() => categoryMonthsChart(counted.value, name.value, colourToken.value, average.value.average, props.window.partMonth, chartTokens()))

const averaged = computed(() => average.value.months)
const averageLink = computed(() => {
  const first = averaged.value[0]
  const last = averaged.value.at(-1)
  return first === undefined || last === undefined ? null : entriesLink(monthRange(first.month, last.month), category.value === null ? null : { category: category.value })
})
const unrated = computed(() => (props.waiting ? null : unratedNote(counted.value.reduce((count, month) => count + month.unrated, 0))))
</script>

<template>
  <div class="flex flex-col gap-6">
    <AnalysisCategoryField :categories="book.categories" />
    <DashboardGrid layout="tiles" data-testid="spending-analysis-over-time-tiles">
      <KpiTile
        :label="words.analysis.overTime.average"
        :value="average.average === null ? words.analysis.overTime.noAverage : formatMoney(shownAsFlow(average.average), 'always')"
        v-bind="averaged.length === 0 ? {} : { caption: plural(words.analysis.overTime.averageCaption(averaged.length), averaged.length) }"
        :to="averageLink"
        data-testid="spending-analysis-average"
      >
        <template #value>
          <span v-if="waiting || average.average === null" class="block type-body font-normal">{{ waiting ? rateWords.loading : words.analysis.overTime.noAverage }}</span>
          <MoneyText v-else :cents="shownAsFlow(average.average)" tone="flow" />
        </template>
      </KpiTile>
      <KpiTile
        :label="words.analysis.overTime.thisMonth"
        :value="formatMoney(shownAsFlow(average.thisMonth.counted), 'always')"
        :caption="`${monthLabel(average.thisMonth.month)} · ${words.analysis.overTime.soFar(average.daysGone, average.daysInMonth)}`"
        :to="transactionsLink(average.thisMonth.month, category)"
        data-testid="spending-analysis-this-month"
      >
        <template #value>
          <span v-if="waiting" class="block type-body font-normal">{{ rateWords.loading }}</span>
          <MoneyText v-else :cents="shownAsFlow(average.thisMonth.counted)" tone="flow" />
        </template>
      </KpiTile>
    </DashboardGrid>
    <ChartCard
      v-model:range="chartRange.range.value"
      :title="words.analysis.overTime.chartTitle"
      :subtitle="unrated ?? name"
      :description="chart.description"
      :option="chart.option"
      :loading="waiting"
      :ranges="chartRange.ranges.value"
      :link-at="(selection) => (months[selection.dataIndex] === undefined ? null : transactionsLink(months[selection.dataIndex]!, category))"
      :height="300"
      :phone-height="260"
      data-testid="spending-analysis-over-time-chart"
    >
      <template #legend><ChartLegend :entries="chart.legend" /></template>
    </ChartCard>
  </div>
</template>
