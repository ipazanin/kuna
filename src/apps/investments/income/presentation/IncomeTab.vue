<script setup lang="ts">
import { computed } from 'vue'

import { incomeByMonth, incomeByYear } from '../domain/incomeHistory'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { incomeByMonthChart } from './incomeCharts'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Income received by month as bars, and by year as gross, withheld and received per kind. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const phone = usePhoneLayout()
const months = computed(() => incomeByMonth(props.sources.book, props.sources.today))
const monthRange = useChartRange(
  () => {
    const [first] = months.value
    const last = months.value.at(-1)
    return first === undefined || last === undefined ? null : wholeMonthsSpan(first.month, last.month)
  },
  () => props.sources.today,
)
const years = computed(() => incomeByYear(props.sources.book, props.sources.today))
const chart = computed(() =>
  incomeByMonthChart(
    months.value.filter((entry) => monthInRange(monthRange.window.value, entry.month)),
    chartTokens(),
    phone.value,
  ),
)
const thisYear = computed(() => yearOf(props.sources.today))
</script>

<template>
  <EmptyState v-if="years.length === 0" icon="i-lucide-coins" :title="words.noIncome.title" :description="words.noIncome.description" data-testid="income-empty" />
  <DashboardGrid v-else data-testid="income-cards">
    <ChartCard
      v-model:range="monthRange.range.value"
      :title="words.byMonth.title"
      :subtitle="words.byMonth.subtitle"
      :option="chart.option"
      :description="chart.description"
      :phone-height="220"
      :ranges="monthRange.ranges.value"
      data-testid="income-by-month"
    />
    <AppCard
      :title="words.byYear.title"
      :subtitle="words.byYear.subtitle"
      collapse-id="investments.performance.income-years"
      :summary="plural(words.byYear.summary(years.length), years.length)"
      data-testid="income-by-year"
    >
      <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.byYear.title">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.byYear.kind }}</th>
            <th scope="col" class="text-end">{{ words.amounts.gross }}</th>
            <th scope="col" class="text-end">{{ words.amounts.withheld }}</th>
            <th scope="col" class="text-end">{{ words.amounts.received }}</th>
          </tr>
        </thead>
        <tbody v-for="year in years" :key="year.year" data-testid="income-year">
          <tr>
            <th scope="rowgroup" class="cell-wraps pt-4 text-start font-medium text-highlighted">
              {{ year.year }}
              <span v-if="year.year === thisYear" class="block type-caption font-normal">{{ words.soFar }}</span>
            </th>
            <td class="pt-4 text-end"><MoneyText :cents="year.total.gross" class="font-medium text-highlighted" /></td>
            <td class="pt-4 text-end"><MoneyText :cents="year.total.withheld" class="font-medium text-highlighted" /></td>
            <td class="pt-4 text-end"><MoneyText :cents="year.total.received" class="font-medium text-highlighted" /></td>
          </tr>
          <tr v-for="group in year.groups" :key="group.group">
            <th scope="row" class="text-start font-normal text-toned">{{ words.byYear.groups[group.group] }}</th>
            <td class="text-end"><MoneyText :cents="group.gross" /></td>
            <td class="text-end"><MoneyText :cents="group.withheld" /></td>
            <td class="text-end"><MoneyText :cents="group.received" /></td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>
  </DashboardGrid>
</template>
