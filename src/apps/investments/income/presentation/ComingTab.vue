<script setup lang="ts">
import { computed } from 'vue'

import { incomeForecast } from '../domain/incomeForecast'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { holdingLink } from '../../holdings/presentation/holdingLinks'
import { comingChart } from './incomeCharts'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The income the next twelve months should bring, copied from the last twelve, as striped bars and a list by month. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const phone = usePhoneLayout()
const forecast = computed(() => incomeForecast(props.sources))
const months = computed(() => forecast.value.months.filter((month) => month.payments.length > 0))
const count = computed(() => months.value.reduce((total, month) => total + month.payments.length, 0))
const chart = computed(() => comingChart(forecast.value, chartTokens(), phone.value))
const legend: readonly LegendEntry[] = [{ label: words.coming.fromLastYear, colour: 'var(--invest-portfolio)', mark: 'hatched' }]
</script>

<template>
  <EmptyState v-if="count === 0" icon="i-lucide-calendar-clock" :title="words.coming.emptyTitle" :description="words.coming.emptyDescription" data-testid="coming-empty" />
  <DashboardGrid v-else data-testid="coming-cards">
    <ChartCard
      :title="words.coming.title"
      :subtitle="words.coming.subtitle(formatMoney(forecast.received))"
      :option="chart.option"
      :description="chart.description"
      :phone-height="220"
      data-testid="coming-chart"
    >
      <template #legend>
        <ChartLegend :entries="legend" />
      </template>
    </ChartCard>
    <AppCard
      :title="words.coming.listTitle"
      :subtitle="words.coming.listSubtitle"
      collapse-id="investments.performance.coming"
      :summary="plural(words.coming.summary(count), count)"
      data-testid="coming-list"
    >
      <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.coming.listTitle">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.coming.day }}</th>
            <th scope="col" class="text-start">{{ words.coming.holding }}</th>
            <th scope="col" class="text-end">{{ words.coming.expected }}</th>
          </tr>
        </thead>
        <tbody v-for="month in months" :key="month.month" data-testid="coming-month">
          <tr>
            <th scope="rowgroup" colspan="2" class="pt-4 text-start font-medium text-highlighted">{{ monthLabel(month.month) }}</th>
            <td class="pt-4 text-end"><MoneyText :cents="month.received" class="font-medium text-highlighted" /></td>
          </tr>
          <tr v-for="payment in month.payments" :key="payment.copied.id" data-testid="coming-payment">
            <th scope="row" class="text-start font-normal text-toned">{{ shortDayLabel(payment.date) }}</th>
            <td class="cell-wraps text-start">
              <DrillLink :to="holdingLink(payment.instrument)">{{ payment.instrument.name }}</DrillLink>
            </td>
            <td class="text-end">
              <MoneyText v-if="payment.received !== null" :cents="payment.received" />
              <span v-else class="type-caption">{{ words.coming.noRate }}</span>
            </td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>
  </DashboardGrid>
</template>
