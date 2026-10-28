<script setup lang="ts">
import { computed } from 'vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import BuildUpList from './BuildUpList.vue'
import { forecastChart } from './forecastChart'
import type { ForecastState } from './forecastView'
import PlanActualList from './PlanActualList.vue'

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
    <UEmpty
      v-if="forecast.state === 'unregistered'"
      icon="i-lucide-calendar-x"
      title="The forecast needs the day the company was registered"
      description="The tax periods, the advances and the balance due all count from it. Set hr_company_registered, such as 2025-05-12."
      :actions="[{ label: 'Set it on Settings', to: { path: '/settings', hash: '#company-registered' }, color: 'neutral', variant: 'outline' }]"
      variant="outline"
      class="rounded-card border-dashed bg-raised/40"
      data-testid="forecast-unregistered"
    />
    <UEmpty
      v-else-if="forecast.state === 'failed'"
      icon="i-lucide-triangle-alert"
      title="The year could not be forecast"
      :description="forecast.failure"
      :actions="[{ label: 'Open Settings', to: '/settings', color: 'neutral', variant: 'outline' }]"
      variant="outline"
      class="rounded-card border-error/40 bg-raised"
      :ui="{ avatar: 'text-error' }"
    />
    <template v-else-if="view && chart">
      <div v-if="view.employment.length > 0 || view.uninvoiced.length > 0 || view.rowsToInvoice > 0" class="flex flex-col gap-2 text-sm text-toned" data-testid="forecast-notices">
        <p v-for="line in view.employment" :key="line" class="flex items-start gap-2">
          <UIcon name="i-lucide-briefcase" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{{ line }}</span>
        </p>
        <p v-if="view.uninvoiced.length > 0" class="flex items-start gap-2">
          <UIcon name="i-lucide-file-question-mark" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
          <span>
            No invoice delivers in {{ view.uninvoiced.map((entry) => entry.month).join(', ') }}, though a later one does, so revenue reads nothing there. Fill
            <span class="identifier">period_from</span> and <span class="identifier">period_to</span> on the invoice that covers it.
          </span>
        </p>
        <p v-if="view.rowsToInvoice > 0" class="flex items-start gap-2" data-testid="forecast-rows-to-invoice">
          <UIcon name="i-lucide-file-clock" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <span>
            {{ view.rowsToInvoice }} {{ view.rowsToInvoice === 1 ? 'plan row' : 'plan rows' }} of {{ year }} {{ view.rowsToInvoice === 1 ? 'is' : 'are' }} not invoiced yet.
            <DrillLink :to="{ path: '/company/invoicing', query: { tab: 'plan', year: String(year) } }" in-prose class="text-highlighted">Invoicing, Plan</DrillLink>
          </span>
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="forecast-tiles">
        <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
      </div>

      <DrillChartCard
        :chart="chart"
        :title="`Month by month, ${year}`"
        subtitle="Income above zero, costs below it and profit before tax as a line. A hatched bar is planned or averaged. A bar the ledger settles opens its rows."
        definition="Complete months come from the ledger as the accountant books them. The running month and later ones take the plan row for the line, or for revenue the billing plan's rows still to invoice, else its average over the last twelve complete months."
        :height="320"
        :phone-height="260"
      >
        <template #legend><ChartLegend :entries="chart.legend" /></template>
      </DrillChartCard>

      <div class="grid gap-4 xl:grid-cols-2">
        <AppCard
          title="Profit and loss"
          subtitle="By the lines the accountant prints. Open a line for what it adds up and the months a plan row or an average stands in for."
          collapse-id="year.forecast-pl"
          :summary="view.profitAndLossSummary"
          start-collapsed
        >
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <BuildUpList :lines="view.profitAndLoss" test-id="forecast-profit-and-loss" />
          </div>
        </AppCard>
        <AppCard
          title="Profit tax return, PD"
          subtitle="From profit to the tax, the advances and the balance, by form line. Open a line for its steps and rules."
          collapse-id="year.forecast-pd"
          :summary="view.pdReturnSummary"
          start-collapsed
        >
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <BuildUpList :lines="view.pdReturn" test-id="forecast-pd-return" />
          </div>
        </AppCard>
      </div>

      <AppCard
        :title="`Cash by month, ${year}`"
        :subtitle="`The bank balance at each month end the ledger has passed, then projected as each month is paid. ${view.paymentLag}.`"
        collapse-id="year.cash"
        :summary="view.cashSummary"
        start-collapsed
        data-testid="forecast-cash"
      >
        <div class="px-4 pt-2 pb-3 sm:px-5">
          <p v-if="view.runway" class="pb-2 text-sm text-toned">
            Cash at the year end lasts {{ view.runway.lasts }} at the cost of October to December, <MoneyText :cents="view.runway.monthlyCost" /> a month with the corporate tax due, as Overview counts runway.
          </p>
          <BuildUpList :lines="view.cashMonths" test-id="forecast-cash-months" />
        </div>
      </AppCard>

      <AppCard
        :title="`Plan against actual, ${year}`"
        subtitle="Each month the ledger settles replaces what the plan had for it, and the plan stays here to compare with. Revenue is held against the billing plan, the owner pay against the plan's scenarios."
        collapse-id="year.plan-actual"
        :summary="view.planActualSummary"
        start-collapsed
        data-testid="forecast-plan-actual"
      >
        <div class="px-4 pt-2 pb-3 sm:px-5">
          <p v-if="view.planActual.length === 0" class="py-4 text-sm text-muted">No month the ledger settles in {{ year }} has a plan to compare with yet.</p>
          <PlanActualList v-else :lines="view.planActual" />
        </div>
      </AppCard>
    </template>
  </div>
</template>
