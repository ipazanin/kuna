<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { MonthKey } from '../../../shared/calendar/monthKey'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { currencyUnitName, formatDecimal, formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { balanceSeries, latestBalances } from '../../cash/domain/balances'
import { TOTAL_SERIES, accountColours, balanceChart } from '../../cash/presentation/cashChart'
import { useFilters } from '../../filters/application/filterStore'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence, lineLabel, shownLines } from '../../settings/domain/profitAndLossLabels'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { ROLLING_3_NET, profitAndLossChart, profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { euroSplit } from '../domain/euroSplit'
import { headline } from '../domain/headline'
import { runway } from '../domain/runway'
import { recentChange, windowAverages } from '../domain/windowAverages'
import { euroDonut } from './overviewCharts'
import { statementsJob, waitingJobs } from './waitingForYou'
import WindowComparison from './WindowComparison.vue'
import type { WindowRow } from './WindowComparison.vue'

const ledger = useFilteredLedger()
const { state } = useWorkbook()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const EMPHASISED_LINES: readonly ProfitAndLossLine[] = ['net', 'ownerEarns']

const LONG_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const LONG_MONTH_AND_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "September" this year, "December 2025" before it. */
function monthName(month: MonthKey): string {
  const date = new Date(`${month}-01`)
  return (date.getUTCFullYear() === new Date().getFullYear() ? LONG_MONTH : LONG_MONTH_AND_YEAR).format(date)
}

function runwayText(months: number | null): string {
  return months === null ? 'No costs' : formatDecimal(months)
}

const statements = useStatementSync()

/** The jobs come from the whole workbook, whatever the filters say, as the menu's review count does. The statements the last sync held come first. */
const waiting = computed(() => {
  if (ledger.value === null || state.workbook === null) return []
  const held = statementsJob(statements.held.value?.length ?? 0, statements.state.outcome?.problem ?? null)
  return [...(held === null ? [] : [held]), ...waitingJobs(ledger.value.workbook, state.workbook.transactions)]
})
const checkText = statements.unchecked

const overview = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { workbook, profitAndLossRows, accountRows, window } = current
  const shown = settings.value
  const tokens = chartTokens()
  const series = profitAndLossSeries(shown)
  const costs = costLabelsInSentence(shown)
  const averages = windowAverages(profitAndLossRows, window)
  const balances = latestBalances(accountRows)
  const recentRunway = runway(balances.cashOnHand, averages.last3)
  const yearRunway = runway(balances.cashOnHand, averages.last12)
  const months = monthlyProfitAndLoss(profitAndLossRows, window)
  const lastTwelve = months.filter((month) => month.complete).slice(-12)
  const balanceMonths = balanceSeries(accountRows, window)
  const cashMonths = balanceMonths.months.slice(-13)
  const lastMonthEnd = [...cashMonths].reverse().find((month) => month.complete) ?? null
  const cashChange = lastMonthEnd === null ? null : balances.cashOnHand.amount - lastMonthEnd.total.amount
  const sinceLabel = averages.allTime === null ? null : `All time, since ${averages.allTime.span.from}`
  const known = workbook.accounts.map((account) => account.slug)
  const colours = accountColours([...known, ...balanceMonths.accounts.filter((account) => !known.includes(account))], tokens)

  const columns = [averages.last3, averages.last12, averages.allTime].flatMap((column) => (column === null ? [] : [column]))
  const columnLabels = ['Last 3 months', 'Last 12 months', ...(sinceLabel === null ? [] : [sinceLabel])]
  // All costs is left out, because the cost lines above it already split it.
  const comparison: WindowRow[] = shownLines(shown)
    .filter((line) => line !== 'cost')
    .map((line) => ({
      label: lineLabel(shown, line),
      emphasised: EMPHASISED_LINES.includes(line),
      cells: columns.map((column) => ({ perMonth: column.lines[line].perMonth, to: drillLocation(column.lines[line].drill) })),
      recentChange: recentChange(averages.last3.lines[line].perMonth, averages.last12.lines[line].perMonth),
    }))

  const costChange = averages.last3.lines.cost.perMonth - averages.last12.lines.cost.perMonth
  const said = headline(months)
  const euro = euroSplit(averages.last12.totals, averages.last12.period)
  const closedCount = balances.accounts.filter((account) => account.closed).length
  return {
    headline:
      said === null
        ? null
        : {
            month: monthName(said.month),
            cameIn: { amount: said.cameIn.amount, to: drillLocation(said.cameIn.drill) },
            wentOut: { amount: said.wentOut.amount, to: drillLocation(said.wentOut.drill) },
            loss: said.loss,
          },
    tiles: [
      {
        label: 'Cash on hand',
        value: formatWholeMoney(balances.cashOnHand.amount),
        to: drillLocation(balances.cashOnHand.drill),
        trend: cashMonths.slice(-12).map((month) => month.total.amount),
        ...(cashChange === null || lastMonthEnd === null
          ? {}
          : { delta: { change: cashChange, text: formatWholeMoney(cashChange, 'always'), comparison: `since the end of ${monthLabel(lastMonthEnd.month)}` } }),
        definition: 'The closing balance of every account in view on its newest booking day, added together.',
      },
      {
        label: 'Net, last 12 months',
        value: formatWholeMoney(averages.last12.lines.net.total),
        to: drillLocation(averages.last12.lines.net.drill),
        trend: lastTwelve.map((month) => month.lines.net.amount),
        caption: `${formatWholeMoney(averages.last12.lines.net.perMonth)} a month`,
        definition: `${shown.bucketLabels.income} less ${costs} over the last 12 complete months. Transfers and reimbursements are left out.`,
      },
      {
        label: 'Monthly costs',
        value: formatWholeMoney(recentRunway.monthlyCost.amount),
        to: drillLocation(recentRunway.monthlyCost.drill),
        trend: lastTwelve.map((month) => month.lines.cost.amount),
        higherIsBetter: false,
        delta: { change: costChange, text: formatWholeMoney(costChange, 'always'), comparison: 'vs the 12-month average' },
        definition: `${costs.charAt(0).toUpperCase()}${costs.slice(1)} over the last three complete months, divided by three.`,
      },
      {
        label: 'Runway',
        value: recentRunway.months === null ? 'No costs' : `${formatDecimal(recentRunway.months)} months`,
        to: drillLocation(recentRunway.monthlyCost.drill),
        caption: `At the 3-month cost, ${runwayText(yearRunway.months)} at the 12-month cost`,
        definition:
          'Cash on hand divided by the monthly costs: how long the company runs if no more income arrives. The figure takes the last three complete months, the caption the last twelve.',
      },
    ],
    comparison,
    columnLabels,
    unit: currencyUnitName(),
    costs,
    monthlyLegend: [
      ...profitAndLossLegend(series),
      { label: ROLLING_3_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const },
      { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
    ],
    monthly: profitAndLossChart(months.slice(-13), tokens, { series, netLine: ROLLING_3_NET }),
    balance: balanceChart(cashMonths, balanceMonths.accounts, colours, tokens, names.value.account),
    balanceLegend: [
      ...balanceMonths.accounts.map((account) => ({ label: names.value.account(account), colour: colours.get(account) ?? 'var(--chart-ink)' })),
      { label: TOTAL_SERIES, colour: 'var(--chart-ink)', mark: 'line' as const },
      { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
    ],
    euro: {
      ...euroDonut(euro, shown, drillLocation),
      total: formatWholeMoney(euro.shortfall ?? euro.whole),
      totalLabel: euro.basis === 'income' ? 'income' : 'more out than in',
      loss: euro.basis === 'cost',
    },
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
    accountsSummary: `${balances.accounts.length} ${balances.accounts.length === 1 ? 'account' : 'accounts'}${closedCount > 0 ? `, ${closedCount} closed` : ''}`,
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Overview" description="How the company is doing, and what waits for you." />
    <LedgerGate>
      <template v-if="ledger && overview">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <p v-if="overview.headline" class="headline" data-testid="headline">
          {{ overview.headline.month }}:
          <DrillLink :to="overview.headline.cameIn.to" in-prose class="headline-figure"><MoneyText :cents="overview.headline.cameIn.amount" precision="whole" /></DrillLink>
          came in and
          <DrillLink :to="overview.headline.wentOut.to" in-prose class="headline-figure"><MoneyText :cents="overview.headline.wentOut.amount" precision="whole" /></DrillLink>
          went out<template v-if="overview.headline.loss !== null">, a loss of
            <MoneyText :cents="overview.headline.loss" precision="whole" class="text-negative" /></template>.
        </p>

        <AppCard v-if="waiting.length || checkText" title="Waiting for you" subtitle="Across the whole workbook, whatever the filters." data-testid="waiting-for-you">
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-if="checkText" class="waiting-line flex-wrap py-1" data-job="check-statements">
              <span class="waiting-dot warning" aria-hidden="true" />
              <span class="min-w-48 flex-1 text-sm text-toned">{{ checkText }}</span>
              <UButton
                label="Check for new statements"
                icon="i-lucide-folder-search"
                color="neutral"
                variant="outline"
                size="sm"
                data-testid="check-statements"
                @click="statements.checkForNewStatements"
              />
            </li>
            <li v-for="job in waiting" :key="job.key" class="waiting-line" :data-job="job.key">
              <span class="waiting-dot" :class="job.tone" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-sm text-toned">{{ job.text }}</span>
              <DrillLink :to="job.link.to" :label="`${job.text}, open ${job.link.label}`" class="shrink-0 text-sm font-medium text-highlighted">{{ job.link.label }}</DrillLink>
            </li>
          </ul>
        </AppCard>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile v-for="tile in overview.tiles" :key="tile.label" v-bind="tile" />
        </div>

        <div class="wide-pair">
          <AppCard
            title="A typical month, three ways"
            subtitle="Each window ends with the last complete month. A wide spread means recent months are not like the rest."
          >
            <div class="px-1 pt-2 pb-2 sm:px-2">
              <WindowComparison :columns="overview.columnLabels" :rows="overview.comparison" />
            </div>
          </AppCard>

          <div class="grid gap-4 xl:grid-cols-2 3xl:contents">
            <DrillChartCard
              :chart="overview.monthly"
              class="xl:col-span-2 3xl:col-span-1"
              title="Income and costs by month"
              subtitle="Last 12 complete months and the month so far. Income above zero, costs below it. Click a month or a bar for its rows."
              :definition="`Costs are ${overview.costs}. The line is the average net of the three months up to each one, so it starts once three complete months exist.`"
              :height="320"
              :phone-height="260"
            >
              <template #legend><ChartLegend :entries="overview.monthlyLegend" /></template>
            </DrillChartCard>

            <DrillChartCard
              :chart="overview.balance"
              title="Balance at month end"
              subtitle="Last 12 months and the month so far, each account stacked with the total on top"
              :height="280"
              :phone-height="240"
            >
              <template #legend><ChartLegend :entries="overview.balanceLegend" /></template>
            </DrillChartCard>

            <DonutCard
              :title="`Every ${overview.unit} earned, last 12 months`"
              :subtitle="overview.euro.loss ? `Costs ran above income, so the ring splits every ${overview.unit} spent.` : `Where each ${overview.unit} of income went.`"
              :definition="`What is kept is income less ${overview.costs}. In a loss nothing is kept, so the ring splits every ${overview.unit} spent instead.`"
              :description="overview.euro.description"
              :parts="overview.euro.parts"
              :total="overview.euro.total"
              :total-label="overview.euro.totalLabel"
            />

            <AppCard
              title="Accounts"
              class="xl:col-span-2"
              collapse-id="overview.accounts"
              :summary="overview.accountsSummary"
              start-collapsed
              subtitle="Each account at its newest balance"
              data-testid="overview-accounts"
            >
              <ul class="account-list mt-3 border-t border-default">
                <li v-for="account in overview.accounts" :key="account.account" class="account-row" :class="{ 'account-closed': account.closed }">
                  <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-2 text-sm text-toned">
                      <span class="size-2.5 shrink-0 rounded-[2px]" :style="{ background: account.colour }" aria-hidden="true" />
                      {{ account.name }}
                      <UBadge v-if="account.closed" label="Closed" color="neutral" variant="subtle" size="sm" />
                    </p>
                    <p class="mt-0.5 text-xs text-muted">As of {{ account.asOf }}. {{ account.count }} rows since {{ account.firstSeen }}.</p>
                  </div>
                  <DrillLink :to="account.to" :label="`${account.name}, every row`" class="shrink-0">
                    <span class="figure text-base font-semibold whitespace-nowrap text-highlighted">{{ formatWholeMoney(account.balance) }}</span>
                  </DrillLink>
                </li>
              </ul>
            </AppCard>
          </div>
        </div>
      </template>
    </LedgerGate>
  </section>
</template>

<style scoped>
.headline {
  max-width: 60ch;
  font-size: 1.125rem;
  line-height: 1.6;
  color: var(--ink-secondary);
}

.headline-figure {
  font-weight: 600;
  color: var(--ink-strong);
}

.waiting-line {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.5rem;
}

.waiting-line + .waiting-line {
  border-top: 1px solid var(--border-default);
}

.waiting-dot {
  width: 0.5rem;
  height: 0.5rem;
  flex: none;
  border-radius: 50%;
}

.waiting-dot.warning {
  background: var(--tone-warning);
}

.waiting-dot.negative {
  background: var(--tone-negative);
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
}

.account-row + .account-row {
  border-top: 1px solid var(--border-default);
}

.account-closed :deep(.text-highlighted) {
  color: var(--ink-muted);
}

@media (min-width: 640px) {
  .account-row {
    padding-inline: 1.25rem;
  }
}

@media (max-width: 639px) {
  .headline {
    font-size: 1rem;
  }
}
</style>
