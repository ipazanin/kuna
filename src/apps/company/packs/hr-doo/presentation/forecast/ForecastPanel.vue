<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import EmptyState from '../../../../../../shared/ui/EmptyState.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import BuildUpList from './BuildUpList.vue'
import { forecastChart } from './forecastChart'
import type { ForecastState } from './forecastView'
import PlanActualList from './PlanActualList.vue'
import { plural } from '../../../../../../shared/text/translation'
import { words } from './words'

/** How a year is likely to end: the ledger's complete months, then the plan or each line's average for the rest. */
const props = defineProps<{
  forecast: ForecastState
  year: number
}>()

const view = computed(() => (props.forecast.state === 'ready' ? props.forecast.view : null))
const chart = computed(() => (view.value === null ? null : forecastChart(view.value.chartMonths, view.value.running, chartTokens())))
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState
      v-if="forecast.state === 'unregistered'"
      icon="i-lucide-calendar-x"
      :title="words.panel.unregisteredTitle"
      :description="words.panel.unregisteredDescription"
      :actions="[{ label: words.panel.setOnSettings, to: { path: '/company/settings', hash: '#company-registered' }, color: 'neutral', variant: 'outline' }]"
      data-testid="forecast-unregistered"
    />
    <EmptyState
      v-else-if="forecast.state === 'failed'"
      icon="i-lucide-triangle-alert"
      :title="words.panel.failedTitle"
      :description="forecast.failure"
      :actions="[{ label: words.panel.openSettings, to: '/company/settings', color: 'neutral', variant: 'outline' }]"
      tone="error"
    />
    <template v-else-if="view && chart">
      <div v-if="view.employment.length > 0 || view.uninvoiced.length > 0 || view.rowsToInvoice > 0" class="flex flex-col gap-2 text-sm text-toned" data-testid="forecast-notices">
        <p v-for="line in view.employment" :key="line" class="flex items-start gap-2">
          <UIcon name="i-lucide-briefcase" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{{ line }}</span>
        </p>
        <p v-if="view.uninvoiced.length > 0" class="flex items-start gap-2">
          <UIcon name="i-lucide-file-question-mark" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {{ words.panel.uninvoicedBefore(view.uninvoiced.map((entry) => entry.month).join(', ')) }}<span class="identifier">period_from</span>{{ words.panel.and
            }}<span class="identifier">period_to</span>{{ words.panel.uninvoicedAfter }}
          </span>
        </p>
        <p v-if="view.rowsToInvoice > 0" class="flex items-start gap-2" data-testid="forecast-rows-to-invoice">
          <UIcon name="i-lucide-file-clock" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            {{ plural(words.panel.rowsToInvoice(view.rowsToInvoice, year), view.rowsToInvoice) }}
            <DrillLink :to="{ path: '/company/invoicing', query: { tab: 'plan', year: String(year) } }" in-prose class="text-highlighted">{{ words.panel.invoicingPlan }}</DrillLink>
          </span>
        </p>
      </div>

      <DashboardGrid layout="tiles" data-testid="forecast-tiles">
        <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
      </DashboardGrid>

      <DrillChartCard :chart="chart" :title="words.panel.monthByMonth(year)" :subtitle="words.panel.chartSubtitle" :definition="words.panel.chartDefinition" :height="320" :phone-height="260">
        <template #legend><ChartLegend :entries="chart.legend" /></template>
      </DrillChartCard>

      <DashboardGrid>
        <AppCard :title="words.panel.profitAndLoss" :subtitle="words.panel.profitAndLossSubtitle" collapse-id="year.forecast-pl" :summary="view.profitAndLossSummary" start-collapsed>
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <BuildUpList :lines="view.profitAndLoss" test-id="forecast-profit-and-loss" />
          </div>
        </AppCard>
        <AppCard :title="words.panel.pdReturn" :subtitle="words.panel.pdReturnSubtitle" collapse-id="year.forecast-pd" :summary="view.pdReturnSummary" start-collapsed>
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <BuildUpList :lines="view.pdReturn" test-id="forecast-pd-return" />
          </div>
        </AppCard>
      </DashboardGrid>

      <AppCard
        :title="words.panel.cashByMonth(year)"
        :subtitle="words.panel.cashSubtitle(view.paymentLag)"
        collapse-id="year.cash"
        :summary="view.cashSummary"
        start-collapsed
        data-testid="forecast-cash"
      >
        <div class="px-4 pt-2 pb-3 sm:px-5">
          <p v-if="view.runway" class="pb-2 text-sm text-toned">{{ words.panel.runwayBefore(view.runway.lasts ?? '') }}<MoneyText :cents="view.runway.monthlyCost" />{{ words.panel.runwayAfter }}</p>
          <BuildUpList :lines="view.cashMonths" test-id="forecast-cash-months" />
        </div>
      </AppCard>

      <AppCard
        :title="words.panel.planActual(year)"
        :subtitle="words.panel.planActualSubtitle"
        collapse-id="year.plan-actual"
        :summary="view.planActualSummary"
        start-collapsed
        data-testid="forecast-plan-actual"
      >
        <div class="px-4 pt-2 pb-3 sm:px-5">
          <p v-if="view.planActual.length === 0" class="py-4 text-sm text-muted">{{ words.panel.noPlanToCompare(year) }}</p>
          <PlanActualList v-else :lines="view.planActual" />
        </div>
      </AppCard>
    </template>
  </div>
</template>
