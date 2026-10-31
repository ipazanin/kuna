<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthInYear, monthLabel } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { currencyUnitName, formatDecimal, formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import { balanceSeries, latestBalances } from '../../cash/domain/balances'
import { accountColours, balanceChart } from '../../cash/presentation/cashChart'
import { words as cashWords } from '../../cash/presentation/words'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../filters/domain/filterState'
import type { Period } from '../../filters/domain/filterState'
import { useStatementSync } from '../../imports/presentation/useStatementSync'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence, lineLabel, shownLines } from '../../settings/domain/profitAndLossLabels'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { ROLLING_3_NET, profitAndLossChart, profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import { words as trendWords } from '../../trends/presentation/words'
import { LINE_BUCKETS, bucketTotals } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import GettingSetUpCard from '../../onboarding/presentation/GettingSetUpCard.vue'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { euroSplit } from '../domain/euroSplit'
import { headline } from '../domain/headline'
import { runway } from '../domain/runway'
import { recentChange, windowAverages } from '../domain/windowAverages'
import { euroDonut } from './overviewCharts'
import { statementsJob, waitingJobs } from './waitingForYou'
import WindowComparison from './WindowComparison.vue'
import type { WindowRow } from './WindowComparison.vue'
import { capitalised } from '../../../../shared/text/capitalised'
import { plural } from '../../../../shared/text/translation'
import type { CroatianForms, EnglishForms } from '../../../../shared/text/translation'
import { words } from './words'

const ledger = useFilteredLedger()
const { state } = useWorkbook()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const EMPHASISED_LINES: readonly ProfitAndLossLine[] = ['net', 'ownerEarns']
const LAST_12_MONTHS: Period = { preset: 'l12' }

/** The months a runway lasts, rounded to the tenth the tile shows, with the unit the language writes them with. */
function runwayText(months: number | null, forms: (text: string) => EnglishForms | CroatianForms): string {
  return months === null ? words.tiles.noCosts : plural(forms(formatDecimal(months)), Math.round(months * 10) / 10)
}

const statements = useStatementSync()

/** The jobs come from the whole workbook, whatever the filters say, as the menu's review count does. The statements the last sync held come first. */
const waiting = computed(() => {
  if (ledger.value === null || state.workbook === null) return []
  const held = statementsJob(statements.held.value?.length ?? 0, statements.state.outcome?.problem ?? null)
  return [...(held === null ? [] : [held]), ...waitingJobs(ledger.value.booked, state.workbook.transactions)]
})

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
  const sinceLabel = averages.allTime === null ? null : words.typicalMonth.allTime(averages.allTime.span.from)
  const known = workbook.accounts.map((account) => account.slug)
  const colours = accountColours([...known, ...balanceMonths.accounts.filter((account) => !known.includes(account))], tokens)

  const columns = [averages.last3, averages.last12, averages.allTime].flatMap((column) => (column === null ? [] : [column]))
  const columnLabels = [words.typicalMonth.last3, words.typicalMonth.last12, ...(sinceLabel === null ? [] : [sinceLabel])]
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
  const lastTwelveTotals = bucketTotals(transactionsInPeriod(profitAndLossRows, LAST_12_MONTHS, window))
  const averagedMonths = `${monthLabel(averages.last12.span.from)} – ${monthLabel(averages.last12.span.to)}`
  const euro = euroSplit(lastTwelveTotals, LAST_12_MONTHS)
  const closedCount = balances.accounts.filter((account) => account.closed).length
  return {
    headline:
      said === null
        ? null
        : {
            month: capitalised(monthInYear(said.month, new Date().getFullYear())),
            cameIn: { amount: said.cameIn.amount, to: drillLocation(said.cameIn.drill) },
            wentOut: { amount: said.wentOut.amount, to: drillLocation(said.wentOut.drill) },
            loss: said.loss,
          },
    tiles: [
      {
        label: words.tiles.cashOnHand,
        value: formatMoney(balances.cashOnHand.amount),
        to: drillLocation(balances.cashOnHand.drill),
        trend: cashMonths.slice(-12).map((month) => month.total.amount),
        ...(cashChange === null || lastMonthEnd === null ? {} : { delta: { change: cashChange, text: formatMoney(cashChange, 'always'), comparison: words.tiles.sinceMonthEnd(lastMonthEnd.month) } }),
        definition: words.tiles.cashDefinition,
      },
      {
        label: words.tiles.net,
        value: formatMoney(lastTwelveTotals.net),
        to: drillLocation(drillToTransactions({ period: LAST_12_MONTHS, buckets: LINE_BUCKETS.net })),
        trend: lastTwelve.map((month) => month.lines.net.amount),
        caption: words.tiles.perMonth(formatMoney(averages.last12.lines.net.perMonth), averagedMonths),
        definition: words.tiles.netDefinition(shown.bucketLabels.income, costs),
      },
      {
        label: words.tiles.monthlyCosts,
        value: formatMoney(recentRunway.monthlyCost.amount),
        to: drillLocation(recentRunway.monthlyCost.drill),
        trend: lastTwelve.map((month) => month.lines.cost.amount),
        higherIsBetter: false,
        delta: { change: costChange, text: formatMoney(costChange, 'always'), comparison: words.tiles.against12Months },
        definition: words.tiles.costsDefinition(costs),
      },
      {
        label: words.tiles.runway,
        value: runwayText(recentRunway.months, words.tiles.months),
        to: drillLocation(recentRunway.monthlyCost.drill),
        caption: words.tiles.runwayCaption(runwayText(yearRunway.months, words.tiles.atYearCost)),
        definition: words.tiles.runwayDefinition,
      },
    ],
    comparison,
    columnLabels,
    unit: currencyUnitName(),
    costs,
    monthlyLegend: [
      ...profitAndLossLegend(series),
      { label: ROLLING_3_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const },
      { label: trendWords.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
    ],
    monthly: profitAndLossChart(months.slice(-13), tokens, { series, netLine: ROLLING_3_NET }),
    balance: balanceChart(cashMonths, balanceMonths.accounts, colours, tokens, names.value.account),
    balanceLegend: [
      ...balanceMonths.accounts.map((account) => ({ label: names.value.account(account), colour: colours.get(account) ?? 'var(--chart-ink)' })),
      { label: cashWords.total, colour: 'var(--chart-ink)', mark: 'line' as const },
      { label: trendWords.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
    ],
    euro: {
      ...euroDonut(euro, shown, drillLocation),
      total: formatMoney(euro.shortfall ?? euro.whole),
      totalLabel: euro.basis === 'income' ? words.euro.income : words.euro.moreOutThanIn,
      loss: euro.basis === 'cost',
    },
    accounts: balances.accounts.map((account) => ({
      account: account.account,
      name: names.value.account(account.account),
      colour: colours.get(account.account) ?? 'var(--chart-ink)',
      balance: account.balance.amount,
      to: drillLocation(account.balance.drill),
      asOf: dayLabel(account.asOf),
      firstSeen: dayLabel(account.firstSeen),
      count: account.transactionCount,
      closed: account.closed,
    })),
    accountsSummary: `${plural(words.accounts.summary(balances.accounts.length), balances.accounts.length)}${closedCount > 0 ? plural(words.accounts.closedCount(closedCount), closedCount) : ''}`,
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <GettingSetUpCard />
    <LedgerGate>
      <template v-if="ledger && overview">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <p v-if="overview.headline" class="headline" data-testid="headline">
          {{ overview.headline.month }}{{ words.headline.opening
          }}<DrillLink :to="overview.headline.cameIn.to" in-prose class="headline-figure"><MoneyText :cents="overview.headline.cameIn.amount" /></DrillLink>{{ words.headline.between
          }}<DrillLink :to="overview.headline.wentOut.to" in-prose class="headline-figure"><MoneyText :cents="overview.headline.wentOut.amount" /></DrillLink>{{ words.headline.closing
          }}<template v-if="overview.headline.loss !== null">{{ words.headline.loss }}<MoneyText :cents="overview.headline.loss" class="text-error" /></template>.
        </p>

        <AppCard v-if="waiting.length" :title="words.waiting.title" :subtitle="words.waiting.subtitle" data-testid="waiting-for-you">
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-for="job in waiting" :key="job.key" class="waiting-line" :data-job="job.key">
              <span class="waiting-dot" :class="job.tone" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-sm text-toned">{{ job.text }}</span>
              <DrillLink :to="job.link.to" :label="words.waiting.open(job.text, job.link.label)" class="shrink-0 text-sm font-medium text-highlighted">{{ job.link.label }}</DrillLink>
            </li>
          </ul>
        </AppCard>

        <DashboardGrid layout="tiles">
          <KpiTile v-for="tile in overview.tiles" :key="tile.label" v-bind="tile" />
        </DashboardGrid>

        <DashboardGrid>
          <AppCard :title="words.typicalMonth.title" :subtitle="words.typicalMonth.subtitle" class="xl:col-span-2 3xl:col-span-1">
            <div class="px-1 pt-2 pb-2 sm:px-2">
              <WindowComparison :columns="overview.columnLabels" :rows="overview.comparison" />
            </div>
          </AppCard>

          <DrillChartCard
            :chart="overview.monthly"
            class="xl:col-span-2"
            :title="words.monthly.title"
            :subtitle="words.monthly.subtitle"
            :definition="words.monthly.definition(overview.costs)"
            :height="320"
            :phone-height="260"
          >
            <template #legend><ChartLegend :entries="overview.monthlyLegend" /></template>
          </DrillChartCard>

          <DrillChartCard :chart="overview.balance" :title="words.balance.title" :subtitle="words.balance.subtitle" :height="280" :phone-height="240">
            <template #legend><ChartLegend :entries="overview.balanceLegend" /></template>
          </DrillChartCard>

          <DonutCard
            class="3xl:col-span-2"
            :title="words.euro.title(overview.unit)"
            :subtitle="overview.euro.loss ? words.euro.lossSubtitle(overview.unit) : words.euro.subtitle(overview.unit)"
            :definition="words.euro.definition(overview.costs, overview.unit)"
            :description="overview.euro.description"
            :parts="overview.euro.parts"
            :total="overview.euro.total"
            :total-label="overview.euro.totalLabel"
          />

          <AppCard
            :title="words.accounts.title"
            class="col-span-full"
            collapse-id="overview.accounts"
            :summary="overview.accountsSummary"
            start-collapsed
            :subtitle="words.accounts.subtitle"
            data-testid="overview-accounts"
          >
            <ul class="mt-3 border-t border-default">
              <li v-for="account in overview.accounts" :key="account.account" class="account-row" :class="{ 'account-closed': account.closed }">
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-2 text-sm text-toned">
                    <span class="size-2.5 shrink-0 rounded-[2px]" :style="{ background: account.colour }" aria-hidden="true" />
                    {{ account.name }}
                    <UBadge v-if="account.closed" :label="words.accounts.closed" color="neutral" variant="subtle" size="sm" />
                  </p>
                  <p class="mt-0.5 text-xs text-muted">{{ plural(words.accounts.asOf(account.asOf, account.count, account.firstSeen), account.count) }}</p>
                </div>
                <DrillLink :to="account.to" :label="words.accounts.everyRow(account.name)" class="shrink-0">
                  <span class="figure text-base font-semibold whitespace-nowrap text-highlighted">{{ formatMoney(account.balance) }}</span>
                </DrillLink>
              </li>
            </ul>
          </AppCard>
        </DashboardGrid>
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
