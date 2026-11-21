<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import AnalysisCategoryField from './AnalysisCategoryField.vue'
import { useAnalysisCategory } from './useAnalysisCategory'
import { words } from './words'
import { yearAgainstYearChart } from './yearAgainstYearChart'
import type { SpendingFigures } from '../domain/spendingFigures'
import { yearChange } from '../domain/yearAgainstYear'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { entriesLink, transactionsLink } from '../../overview/presentation/spendingLinks'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { words as rateWords } from '../../rates/presentation/words'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { monthKey, monthNumber } from '../../../../shared/calendar/monthKey'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { ledgerYears } from '../../../../shared/calendar/periodPresets'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney, formatPercentChange } from '../../../../shared/money/moneyFormat'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import type { ChartPointSelection } from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** One category's months of a year beside last year's, and the year so far against the same days a year before. */
const props = defineProps<{
  book: SpendingBook
  figures: SpendingFigures
  window: LedgerWindow
  waiting: boolean
  day: CivilDate
}>()

const route = useRoute()
const router = useRouter()

const category = useAnalysisCategory(() => props.book.categories)
const name = computed(() => category.value?.name ?? words.analysis.overTime.allSpending)
const colourToken = computed(() => (category.value === null ? '--chart-ink-muted' : categoryColours(props.book.categories)(category.value)))
const income = computed(() => category.value?.kind === 'income')
const shownAsFlow = (amount: Money): Money => (income.value ? amount : negateMoney(amount))

/** The day's year stays out of `?year=`. */
const thisYear = yearOf(props.day)
const years = computed(() => ledgerYears(props.window).map((value) => ({ value, label: String(value) })))
const year = computed<number>({
  get: () => years.value.find((offered) => String(offered.value) === route.query.year)?.value ?? thisYear,
  set: (picked) => {
    const { year: _left, ...others } = route.query
    void router.replace({ query: picked === thisYear ? others : { ...others, year: String(picked) } })
  },
})

const figures = computed(() => props.figures.yearAgainstYearOf(category.value, year.value, props.day))
const change = computed(() => yearChange(figures.value))
const chart = computed(() => yearAgainstYearChart(figures.value, name.value, colourToken.value, props.window.partMonth, chartTokens()))
const whole = computed(() => year.value < thisYear)
const group = computed(() => (category.value === null ? null : { category: category.value }))

/** A bar opens its month's entries, last year's bar the month a year before. */
function monthLink(selection: ChartPointSelection): RouteLocationRaw | null {
  const month = figures.value.months[selection.dataIndex]?.month
  if (month === undefined) return null
  return transactionsLink(selection.seriesName === String(year.value - 1) ? monthKey(year.value - 1, monthNumber(month)) : month, category.value)
}
const delta = computed(() =>
  change.value.share === null ? undefined : { change: change.value.change, text: formatPercentChange(change.value.share), comparison: words.analysis.year.against(year.value - 1) },
)
const unrated = computed(() => (props.waiting ? null : unratedNote(figures.value.toDate.unrated + figures.value.lastYearToDate.unrated)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-3">
      <AnalysisCategoryField :categories="book.categories" />
      <ChoiceButtons v-if="years.length > 1" v-model="year" :options="years" :label="words.analysis.year.year" data-testid="spending-analysis-year" />
    </div>
    <DashboardGrid layout="tiles" data-testid="spending-analysis-year-tiles">
      <KpiTile
        :label="whole ? words.analysis.year.toDateWhole(year) : words.analysis.year.toDate(year)"
        :value="formatMoney(shownAsFlow(figures.toDate.counted), 'always')"
        v-bind="delta === undefined ? {} : { delta }"
        :higher-is-better="income"
        :to="entriesLink(figures.toDate.days, group)"
        data-testid="spending-analysis-year-to-date"
      >
        <template #value>
          <span v-if="waiting" class="block type-body font-normal">{{ rateWords.loading }}</span>
          <MoneyText v-else :cents="shownAsFlow(figures.toDate.counted)" tone="flow" />
        </template>
      </KpiTile>
      <KpiTile
        :label="words.analysis.year.lastYear(year - 1)"
        :value="formatMoney(shownAsFlow(figures.lastYearToDate.counted), 'always')"
        :to="entriesLink(figures.lastYearToDate.days, group)"
        data-testid="spending-analysis-last-year"
      >
        <template #value>
          <span v-if="waiting" class="block type-body font-normal">{{ rateWords.loading }}</span>
          <MoneyText v-else :cents="shownAsFlow(figures.lastYearToDate.counted)" tone="flow" />
        </template>
      </KpiTile>
    </DashboardGrid>
    <ChartCard
      :title="words.analysis.year.chartTitle(year)"
      :subtitle="unrated ?? name"
      :description="chart.description"
      :option="chart.option"
      :loading="waiting"
      :category-label="chart.categoryLabel"
      :link-at="monthLink"
      :height="300"
      :phone-height="260"
      data-testid="spending-analysis-year-chart"
    >
      <template #legend><ChartLegend :entries="chart.legend" /></template>
    </ChartCard>
  </div>
</template>
