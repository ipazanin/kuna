<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { completeRange } from '../../../shared/calendar/ledgerWindow'
import { monthsOfRange } from '../../../shared/calendar/dateRange'
import { chartTokens } from '../../../shared/charts/chartTokens'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { formatPercent } from '../../../shared/money/euroFormat'
import { useFilters } from '../../filters/application/filterStore'
import type { Figure } from '../../filters/domain/drillTarget'
import { useChartDrill } from '../../filters/presentation/chartDrill'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { categoryTotals, outsideProfitAndLossTotals } from '../../spending/domain/categoryTotals'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { MONTHLY_NET, profitAndLossChart } from '../../trends/presentation/profitAndLossChart'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { periodReview, reviewPeriodOf } from '../domain/periodReview'
import type { ReviewPeriod } from '../domain/periodReview'

const ledger = useFilteredLedger()
const { drillLocation } = useFilters()
const openChartDrill = useChartDrill()

const LINE_LABELS: Readonly<Record<ProfitAndLossLine, string>> = {
  income: 'Income',
  operating: 'Operating cost',
  taxes: 'Taxes',
  ownerPay: 'Owner pay',
  cost: 'All costs',
  net: 'Net',
  ownerEarns: 'Owner earns',
}

/** Costs read positive, so a fall in one of them is the good direction. */
const COST_LINES: readonly ProfitAndLossLine[] = ['operating', 'taxes', 'ownerPay', 'cost']

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function periodLabel(period: ReviewPeriod): string {
  switch (period.preset) {
    case 'year':
      return String(period.year)
    case 'quarter':
      return `Q${period.quarter} ${period.year}`
    case 'custom':
      return `${dayFormat.format(new Date(period.range.from))} to ${dayFormat.format(new Date(period.range.to))}`
  }
}

const review = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { scoped, window, filters } = current
  const period = reviewPeriodOf(filters.period, window)
  const result = periodReview(scoped, period, window)
  const covered = completeRange(window)
  const months = new Set(monthsOfRange(result.current.range))
  const totals = categoryTotals(scoped, period, window)
  const rowOf = (total: { readonly category: string; readonly family: string; readonly amount: Figure }, share: number | null) => ({
    category: total.category,
    family: total.family,
    amount: total.amount.amount,
    to: drillLocation(total.amount.drill),
    share,
  })
  return {
    period,
    currentLabel: periodLabel(result.current.period),
    priorLabel: result.prior === null ? null : periodLabel(result.prior.period),
    currentPartial: result.current.partial,
    priorPartial: result.prior?.partial ?? false,
    coverage: `The ledger covers complete months from ${dayFormat.format(new Date(covered.from))} to ${dayFormat.format(new Date(covered.to))}.`,
    lines: result.lines.map((line) => ({
      line: line.line,
      label: LINE_LABELS[line.line],
      emphasised: line.line === 'net' || line.line === 'ownerEarns',
      current: line.current.amount,
      currentTo: drillLocation(line.current.drill),
      prior: line.prior?.amount ?? null,
      priorTo: line.prior === null ? null : drillLocation(line.prior.drill),
      change: line.change,
      changeSign: line.change === null ? 0 : COST_LINES.includes(line.line) ? -line.change : line.change,
    })),
    byMonth: profitAndLossChart(
      monthlyProfitAndLoss(scoped, window).filter((month) => months.has(month.month)),
      chartTokens(),
      { netLine: MONTHLY_NET },
    ),
    sections: [
      { title: 'Income', note: 'Share of all income', rows: totals.filter((total) => total.direction === 'income').map((total) => rowOf(total, total.share)) },
      { title: 'Costs', note: 'Share of all costs', rows: totals.filter((total) => total.direction === 'cost').map((total) => rowOf(total, total.share)) },
      {
        title: 'Outside profit and loss',
        note: 'Reimbursements and other financing settle costs counted above, so they have no share of either',
        rows: outsideProfitAndLossTotals(scoped, period, window).map((total) => rowOf(total, null)),
      },
    ].filter((section) => section.rows.length > 0),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Period review" description="A year, quarter or custom range against the equal period just before it." />
    <LedgerGate>
      <template v-if="ledger && review">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :presets="['year', 'quarter', 'custom']" :shown-period="review.period" />

        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 class="text-lg font-semibold text-highlighted">
            {{ review.currentLabel }}<span v-if="review.priorLabel" class="font-normal text-muted"> against {{ review.priorLabel }}</span>
          </h2>
          <UBadge v-if="review.currentPartial" :label="`${review.currentLabel} is partial`" color="warning" variant="subtle" size="sm" icon="i-lucide-calendar-clock" />
          <UBadge v-if="review.priorPartial" :label="`${review.priorLabel} is partial, so no change is shown`" color="warning" variant="subtle" size="sm" icon="i-lucide-calendar-clock" />
          <p v-if="review.currentPartial || review.priorPartial" class="w-full text-xs text-muted">{{ review.coverage }}</p>
        </div>

        <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">Profit and loss</h2>
            </header>
            <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
              <table class="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" class="text-start">Line</th>
                    <th scope="col" class="text-end">{{ review.currentLabel }}</th>
                    <th scope="col" class="text-end">{{ review.priorLabel ?? 'Prior period' }}</th>
                    <th scope="col" class="text-end">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="line in review.lines" :key="line.line">
                    <th scope="row" class="text-start" :class="line.emphasised ? 'font-medium text-highlighted' : 'font-normal text-toned'">{{ line.label }}</th>
                    <td class="text-end">
                      <DrillLink :to="line.currentTo" :label="`${line.label}, ${review.currentLabel}, open the rows`">
                        <MoneyText :cents="line.current" precision="whole" />
                      </DrillLink>
                    </td>
                    <td class="text-end">
                      <DrillLink v-if="line.prior !== null" :to="line.priorTo" :label="`${line.label}, ${review.priorLabel}, open the rows`">
                        <MoneyText :cents="line.prior" precision="whole" class="text-muted" />
                      </DrillLink>
                      <span v-else class="text-dimmed">No data</span>
                    </td>
                    <td class="text-end">
                      <MoneyText
                        v-if="line.change !== null"
                        :cents="line.change"
                        precision="whole"
                        sign="always"
                        :class="line.changeSign > 0 ? 'text-positive' : line.changeSign < 0 ? 'text-negative' : 'text-muted'"
                      />
                      <span v-else class="text-dimmed">–</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <ChartCard
            title="By month"
            :subtitle="review.currentLabel"
            :description="review.byMonth.description"
            :option="review.byMonth.option"
            :height="300"
            @select="openChartDrill(review.byMonth, $event)"
          >
            <template #legend>
              <ChartLegend
                :entries="[
                  { label: 'Income', colour: 'var(--bucket-income)' },
                  { label: 'Operating', colour: 'var(--bucket-operating)' },
                  { label: 'Taxes', colour: 'var(--bucket-taxes)' },
                  { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
                  { label: 'Net', colour: 'var(--chart-ink)', mark: 'line' },
                ]"
              />
            </template>
          </ChartCard>
        </div>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">By category</h2>
            <p class="mt-0.5 text-xs text-muted">{{ review.currentLabel }}. Each share is within its own direction.</p>
          </header>
          <p v-if="review.sections.length === 0" class="px-5 py-8 text-sm text-muted">No categorised rows in this period.</p>
          <div v-else class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
            <table class="data-table w-full text-sm">
              <template v-for="section in review.sections" :key="section.title">
                <thead>
                  <tr>
                    <th scope="colgroup" class="section-heading text-start">{{ section.title }}</th>
                    <th scope="col" class="hidden text-start sm:table-cell">Family</th>
                    <th scope="col" class="text-end">Amount</th>
                    <th scope="col" class="text-end" :title="section.note">Share</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in section.rows" :key="row.category">
                    <th scope="row" class="text-start font-normal">
                      <DrillLink :to="row.to" class="text-highlighted">{{ row.category }}</DrillLink>
                    </th>
                    <td class="hidden text-muted sm:table-cell">{{ row.family }}</td>
                    <td class="text-end"><MoneyText :cents="row.amount" precision="whole" /></td>
                    <td class="figure text-end text-muted">
                      <template v-if="row.share !== null">{{ formatPercent(row.share) }}</template>
                      <span v-else class="text-dimmed" :title="section.note">–</span>
                    </td>
                  </tr>
                </tbody>
              </template>
            </table>
          </div>
          <p v-if="review.sections.some((section) => section.title === 'Outside profit and loss')" class="px-4 pb-4 text-xs text-muted sm:px-5">
            Outside profit and loss: reimbursements and other financing settle costs counted above, so they are listed here and have no share of
            either direction.
          </p>
        </section>
      </template>
    </LedgerGate>
  </section>
</template>

<style scoped>
.data-table thead:not(:first-child) th {
  padding-top: 1.25rem;
}

.data-table thead th.section-heading {
  color: var(--ink-strong);
  font-size: 0.8125rem;
}
</style>
