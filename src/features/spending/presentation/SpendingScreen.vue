<script setup lang="ts">
import { computed } from 'vue'

import { monthLabel } from '../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../shared/charts/chartTokens'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import SparkLine from '../../../shared/ui/SparkLine.vue'
import { useFilters } from '../../filters/application/filterStore'
import { periodRange } from '../../filters/domain/filterState'
import type { Period } from '../../filters/domain/filterState'
import { priorEqualPeriod } from '../../filters/domain/periodComparison'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence } from '../../settings/domain/profitAndLossLabels'
import { profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../shared/calendar/monthKey'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { categoryTotals } from '../domain/categoryTotals'
import { topCounterparties } from '../domain/topCounterparties'
import { PRIOR_SERIES, categoryComparisonChart } from './spendingCharts'
import type { ComparedCategory } from './spendingCharts'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()

function describePeriod(period: Period, window: LedgerWindow): string {
  const range = periodRange(period, window)
  return range === null ? 'all time' : `${monthLabel(monthOf(range.from))} to ${monthLabel(monthOf(range.to))}`
}

const spending = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { scoped, window, filters } = current
  const prior = priorEqualPeriod(filters.period, window)
  const costs = categoryTotals(scoped, filters.period, window).filter((total) => total.direction === 'cost')
  const priorCosts = prior === null ? [] : categoryTotals(scoped, prior, window).filter((total) => total.direction === 'cost')
  const priorByCategory = new Map(priorCosts.map((total) => [total.category, total]))
  const compared: ComparedCategory[] = [
    ...costs.map((total) => ({
      category: total.category,
      bucket: total.bucket,
      current: total.amount,
      prior: priorByCategory.get(total.category)?.amount ?? null,
    })),
    ...priorCosts
      .filter((total) => !costs.some((now) => now.category === total.category))
      .map((total) => ({ category: total.category, bucket: total.bucket, current: null, prior: total.amount })),
  ]
  const priorLabel = prior === null ? null : describePeriod(prior, window)
  const payees = topCounterparties(scoped, filters.period, window)
  const costLabels = costLabelsInSentence(settings.value)
  return {
    definition: `${costLabels.charAt(0).toUpperCase()}${costLabels.slice(1)} by category. A refund in a cost category lowers its bar. Transfers and reimbursements are not costs, so they are left out.`,
    legend: [
      ...profitAndLossLegend(profitAndLossSeries(settings.value).filter((series) => series.line !== 'income')),
      ...(priorLabel === null ? [] : [{ label: PRIOR_SERIES, colour: 'var(--chart-ghost)', mark: 'ghost' as const }]),
    ],
    chart: categoryComparisonChart(compared, chartTokens(), priorLabel),
    count: compared.length,
    periodLabel: describePeriod(filters.period, window),
    priorLabel,
    payees: payees.map((payee) => ({
      key: payee.key,
      label: payee.label,
      to: drillLocation(payee.total.drill),
      total: payee.total.amount,
      count: payee.transactionCount,
      trend: payee.monthly.map((month) => month.amount),
    })),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Spending" description="Where the money goes, and who it goes to." />
    <LedgerGate>
      <template v-if="ledger && spending">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

        <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <DrillChartCard
            :chart="spending.chart"
            title="Cost by category"
            :subtitle="spending.priorLabel === null ? `${spending.periodLabel}. All time has no period before it.` : `${spending.periodLabel}, against ${spending.priorLabel}`"
            :definition="spending.definition"
            :empty="spending.count === 0"
            :height="Math.max(200, spending.count * 30 + 40)"
          >
            <template #legend><ChartLegend :entries="spending.legend" /></template>
          </DrillChartCard>

          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">Who the company paid most</h2>
              <p class="mt-0.5 text-xs text-muted">{{ spending.periodLabel }}. Money out only, grouped by IBAN or name.</p>
            </header>
            <p v-if="spending.payees.length === 0" class="px-5 py-8 text-sm text-muted">Nothing left the company in this period.</p>
            <div v-else class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
              <table class="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" class="text-start">Counterparty</th>
                    <th scope="col" class="hidden sm:table-cell"><span class="sr-only">Monthly trend</span></th>
                    <th scope="col" class="text-end">Rows</th>
                    <th scope="col" class="text-end">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="payee in spending.payees" :key="payee.key">
                    <th scope="row" class="max-w-56 truncate text-start font-normal">
                      <DrillLink :to="payee.to" class="text-highlighted">{{ payee.label }}</DrillLink>
                    </th>
                    <td class="hidden sm:table-cell"><SparkLine :points="payee.trend" :width="96" :height="22" /></td>
                    <td class="figure text-end text-muted">{{ payee.count }}</td>
                    <td class="text-end">
                      <DrillLink :to="payee.to" :label="`${payee.label}, open the rows`">
                        <MoneyText :cents="payee.total" precision="whole" />
                      </DrillLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
