<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatDecimal, formatWholeMoney } from '../../../shared/money/moneyFormat'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../filters/application/filterStore'
import { chartedMonths } from '../../filters/domain/periodPresets'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { runway } from '../../overview/domain/runway'
import { windowAverages } from '../../overview/domain/windowAverages'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { balanceSeries, latestBalances } from '../domain/balances'
import { TOTAL_SERIES, accountColours, balanceChart } from './cashChart'

const ledger = useFilteredLedger()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function runwayText(months: number | null): string {
  return months === null ? 'No costs' : `${formatDecimal(months)} months`
}

const cash = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { workbook, accountRows, scoped, window, filters } = current
  const tokens = chartTokens()
  const balances = latestBalances(accountRows)
  const series = balanceSeries(accountRows, window)
  const charted = new Set(chartedMonths(filters.period, window))
  const known = workbook.accounts.map((account) => account.slug)
  const colours = accountColours([...known, ...series.accounts.filter((account) => !known.includes(account))], tokens)
  const averages = windowAverages(scoped, window)
  const runways = [
    { label: "Runway at the last 3 months' cost", runway: runway(balances.cashOnHand, averages.last3) },
    { label: "Runway at the last 12 months' cost", runway: runway(balances.cashOnHand, averages.last12) },
  ]
  return {
    chart: balanceChart(series.months.filter((month) => charted.has(month.month)), series.accounts, colours, tokens, names.value.account),
    empty: !series.months.some((month) => charted.has(month.month)),
    legend: [
      ...series.accounts.map((account) => ({ label: names.value.account(account), colour: colours.get(account) ?? 'var(--chart-ink)' })),
      { label: TOTAL_SERIES, colour: 'var(--chart-ink)', mark: 'line' as const },
      { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
    ],
    cashOnHand: { amount: balances.cashOnHand.amount, to: drillLocation(balances.cashOnHand.drill) },
    runways: runways.map(({ label, runway: estimate }) => ({
      label,
      value: runwayText(estimate.months),
      to: drillLocation(estimate.monthlyCost.drill),
      caption: `Cash on hand over ${formatWholeMoney(estimate.monthlyCost.amount)} a month`,
    })),
    accounts: balances.accounts.map((account) => ({
      account: account.account,
      name: names.value.account(account.account),
      colour: colours.get(account.account) ?? 'var(--chart-ink)',
      balance: account.balance.amount,
      to: drillLocation(account.balance.drill),
      asOf: dayFormat.format(new Date(account.asOf)),
      firstSeen: dayFormat.format(new Date(account.firstSeen)),
      count: account.transactionCount,
      closed: account.closed,
    })),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Cash" description="Where the money is, and how long it lasts." />
    <LedgerGate>
      <template v-if="ledger && cash">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <KpiTile
            label="Cash on hand"
            :value="formatWholeMoney(cash.cashOnHand.amount)"
            :to="cash.cashOnHand.to"
            caption="Every account in view at its latest balance"
          />
          <KpiTile
            v-for="estimate in cash.runways"
            :key="estimate.label"
            v-bind="estimate"
            definition="How many months the cash lasts if no more income arrives and costs stay at that window's monthly average."
          />
        </div>

        <DrillChartCard
          :chart="cash.chart"
          title="Balance at month end"
          subtitle="Each account stacked, with the total on top"
          :empty="cash.empty"
          :height="320"
          :phone-height="260"
        >
          <template #legend><ChartLegend :entries="cash.legend" /></template>
        </DrillChartCard>

        <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <li
            v-for="account in cash.accounts"
            :key="account.account"
            class="flex flex-col gap-2 rounded-card border border-default bg-raised p-4 shadow-raised"
            :class="{ 'account-closed': account.closed }"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="flex items-center gap-2 text-sm text-toned">
                <span class="size-2.5 rounded-[2px]" :style="{ background: account.colour }" aria-hidden="true" />
                {{ account.name }}
              </p>
              <UBadge v-if="account.closed" label="Closed" color="neutral" variant="subtle" size="sm" />
            </div>
            <DrillLink :to="account.to" :label="`${account.name}, every row`" class="self-start">
              <span class="text-figure-lg font-semibold whitespace-nowrap text-highlighted">{{ formatWholeMoney(account.balance) }}</span>
            </DrillLink>
            <p class="text-xs text-muted">As of {{ account.asOf }}. {{ account.count }} rows since {{ account.firstSeen }}.</p>
          </li>
        </ul>
      </template>
    </LedgerGate>
  </section>
</template>

<style scoped>
.account-closed {
  background: transparent;
  box-shadow: none;
  border-style: dashed;
}

.account-closed :deep(.text-highlighted) {
  color: var(--ink-muted);
}
</style>
