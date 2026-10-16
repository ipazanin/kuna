<script setup lang="ts">
import { computed } from 'vue'

import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatWholeEuros } from '../../../shared/money/euroFormat'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { balanceSeries, latestBalances } from '../../cash/domain/balances'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { useChartDrill } from '../../filters/presentation/chartDrill'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { categoryTotals } from '../../spending/domain/categoryTotals'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { ROLLING_3_NET, profitAndLossChart } from '../../trends/presentation/profitAndLossChart'
import { needsReview } from '../../workbook/domain/needsReview'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { euroSplit } from '../domain/euroSplit'
import { runway } from '../domain/runway'
import { windowAverages } from '../domain/windowAverages'
import { categoryBarsChart, euroSplitChart } from './overviewCharts'
import WindowComparison from './WindowComparison.vue'
import type { WindowRow } from './WindowComparison.vue'

const ledger = useFilteredLedger()
const { drillLocation } = useFilters()
const openChartDrill = useChartDrill()

const COMPARED_LINES = [
  { line: 'income', label: 'Income' },
  { line: 'operating', label: 'Operating cost' },
  { line: 'taxes', label: 'Taxes' },
  { line: 'ownerPay', label: 'Owner pay' },
  { line: 'net', label: 'Net', emphasised: true },
  { line: 'ownerEarns', label: 'Owner earns', emphasised: true },
] as const

const BUCKET_LEGEND = [
  { label: 'Income', colour: 'var(--bucket-income)' },
  { label: 'Operating', colour: 'var(--bucket-operating)' },
  { label: 'Taxes', colour: 'var(--bucket-taxes)' },
  { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
  { label: ROLLING_3_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const },
  { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
]

const SPLIT_LEGEND = [
  { label: 'Kept', colour: 'var(--bucket-income)' },
  { label: 'Operating', colour: 'var(--bucket-operating)' },
  { label: 'Taxes', colour: 'var(--bucket-taxes)' },
  { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
]

const overview = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { scoped, accountRows, window } = current
  const tokens = chartTokens()
  const averages = windowAverages(scoped, window)
  const balances = latestBalances(accountRows)
  const recentRunway = runway(balances.cashOnHand, averages.last3)
  const series = monthlyProfitAndLoss(scoped, window)
  const lastTwelve = series.filter((month) => month.complete).slice(-12)
  const lastTwelveAndMonthSoFar = series.slice(-13)
  const cashMonths = balanceSeries(accountRows, window).months.slice(-12)
  const reviewCount = scoped.filter(needsReview).length
  const sinceLabel = averages.allTime === null ? null : `All time, since ${averages.allTime.span.from}`

  const columns = [averages.last3, averages.last12, averages.allTime].flatMap((column) => (column === null ? [] : [column]))
  const columnLabels = ['Last 3 months', 'Last 12 months', ...(sinceLabel === null ? [] : [sinceLabel])]
  const comparison: WindowRow[] = COMPARED_LINES.map(({ line, label, ...rest }) => ({
    label,
    emphasised: 'emphasised' in rest,
    cells: columns.map((column) => ({ perMonth: column.lines[line].perMonth, to: drillLocation(column.lines[line].drill) })),
  }))

  const operating = categoryTotals(scoped, { preset: 'l12' }, window).filter((total) => total.bucket === 'operating')
  const costChange = averages.last3.lines.cost.perMonth - averages.last12.lines.cost.perMonth

  return {
    tiles: [
      {
        label: 'Cash on hand',
        value: formatWholeEuros(balances.cashOnHand.amount),
        to: drillLocation(balances.cashOnHand.drill),
        trend: cashMonths.map((month) => month.total.amount),
        definition: 'The closing balance of every account in view on its newest booking day, added together.',
      },
      {
        label: 'Net, last 12 months',
        value: formatWholeEuros(averages.last12.lines.net.total),
        to: drillLocation(averages.last12.lines.net.drill),
        trend: lastTwelve.map((month) => month.lines.net.amount),
        caption: `${formatWholeEuros(averages.last12.lines.net.perMonth)} a month`,
        definition: 'Income less operating cost, taxes and owner pay over the last 12 complete months. Transfers and reimbursements are left out.',
      },
      {
        label: 'Monthly costs',
        value: formatWholeEuros(recentRunway.monthlyCost.amount),
        to: drillLocation(recentRunway.monthlyCost.drill),
        trend: lastTwelve.map((month) => month.lines.cost.amount),
        higherIsBetter: false,
        delta: { change: costChange, text: formatWholeEuros(costChange, 'always'), comparison: 'vs the 12-month average' },
        definition: 'Operating cost, taxes and owner pay over the last three complete months, divided by three.',
      },
      {
        label: 'Runway',
        value: recentRunway.months === null ? 'No costs' : `${recentRunway.months.toFixed(1)} months`,
        to: drillLocation(recentRunway.monthlyCost.drill),
        caption: "At the last 3 months' cost",
        definition: 'Cash on hand divided by the monthly costs: how long the company runs if no more income arrives.',
      },
      {
        label: 'Needs review',
        value: `${reviewCount} ${reviewCount === 1 ? 'row' : 'rows'}`,
        to: drillLocation(drillToTransactions({ period: { preset: 'all' }, needsReview: true })),
        caption: 'Guessed by AI or not classified',
        definition: 'Rows whose category the AI guessed, and rows whose category is missing from the categories tab.',
      },
    ],
    comparison,
    columnLabels,
    split: euroSplitChart(
      [
        { label: 'Last 3 months', split: euroSplit(averages.last3.totals, averages.last3.span.monthCount, averages.last3.period) },
        { label: 'Last 12 months', split: euroSplit(averages.last12.totals, averages.last12.span.monthCount, averages.last12.period) },
        ...(averages.allTime === null || sinceLabel === null
          ? []
          : [{ label: sinceLabel, split: euroSplit(averages.allTime.totals, averages.allTime.span.monthCount, averages.allTime.period) }]),
      ],
      tokens,
    ),
    monthly: profitAndLossChart(lastTwelveAndMonthSoFar, tokens, { netLine: ROLLING_3_NET }),
    operating: categoryBarsChart(operating, tokens, 'Operating cost'),
    operatingCount: operating.length,
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Overview" description="How the company is doing, and what a normal month looks like." />
    <LedgerGate>
      <template v-if="ledger && overview">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <KpiTile
            v-for="(tile, index) in overview.tiles"
            :key="tile.label"
            v-bind="tile"
            :class="index < 3 ? 'lg:col-span-2' : 'lg:col-span-3'"
          />
        </div>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
            <div>
              <h2 class="text-sm font-medium text-highlighted">A typical month, three ways</h2>
              <p class="mt-0.5 text-xs text-muted">
                Each window ends with the last complete month. A wide spread means recent months are not like the rest.
              </p>
            </div>
          </header>
          <div class="px-1 pt-2 pb-2 sm:px-2">
            <WindowComparison :columns="overview.columnLabels" :rows="overview.comparison" />
          </div>
        </section>

        <div class="grid items-start gap-4 xl:grid-cols-2">
          <ChartCard
            class="xl:col-span-2"
            title="Income and costs by month"
            subtitle="Last 12 complete months and the month so far. Income above zero, costs below it. Click a bar for its rows."
            definition="Costs are operating, taxes and owner pay. The line is the average net of the three months up to each one, so it starts once three complete months exist."
            :description="overview.monthly.description"
            :option="overview.monthly.option"
            :height="320"
            @select="openChartDrill(overview.monthly, $event)"
          >
            <template #legend><ChartLegend :entries="BUCKET_LEGEND" /></template>
          </ChartCard>

          <ChartCard
            title="Every euro earned"
            subtitle="Where each euro of income went, per window."
            definition="Each bar is one window and adds up to 100%. In a loss there is nothing kept, so the bar splits every euro spent instead."
            :description="overview.split.description"
            :option="overview.split.option"
            :height="180"
            @select="openChartDrill(overview.split, $event)"
          >
            <template #legend><ChartLegend :entries="SPLIT_LEGEND" /></template>
          </ChartCard>

          <ChartCard
            title="Operating cost by category"
            subtitle="Last 12 complete months"
            :description="overview.operating.description"
            :option="overview.operating.option"
            :empty="overview.operatingCount === 0"
            :height="Math.max(180, overview.operatingCount * 30 + 40)"
            @select="openChartDrill(overview.operating, $event)"
          />
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
