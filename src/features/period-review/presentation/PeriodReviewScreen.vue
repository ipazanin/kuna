<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { chartTokens } from '../../../shared/charts/chartTokens'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { useFilters } from '../../filters/application/filterStore'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useSettings } from '../../settings/application/useSettings'
import { lineLabel, lineShown } from '../../settings/domain/profitAndLossLabels'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { monthlyProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { MONTHLY_NET, profitAndLossChart, profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { displayName } from '../../workbook/domain/displayName'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { categoryChanges } from '../domain/categoryChanges'
import type { CategoryChange } from '../domain/categoryChanges'
import { periodReview, reviewPeriodOf } from '../domain/periodReview'
import type { PeriodReview, ReviewPeriod } from '../domain/periodReview'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

/** Costs read positive, so a fall in one of them is the good direction. */
const COST_LINES: readonly ProfitAndLossLine[] = ['operating', 'taxes', 'ownerPay', 'cost']

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const MONTH_ONLY = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

/** "Jan – Sept 2026" within a year, "Jun 2025 – Feb 2026" across one. */
function monthSpan(months: { readonly from: MonthKey; readonly to: MonthKey }): string {
  if (months.from === months.to) return monthLabel(months.from)
  const sameYear = months.from.slice(0, 4) === months.to.slice(0, 4)
  return `${sameYear ? MONTH_ONLY.format(new Date(`${months.from}-01`)) : monthLabel(months.from)} – ${monthLabel(months.to)}`
}

/** One sentence on what is compared, when the ledger leaves out part of either period. Null when both are whole. */
function coverageSentence(result: PeriodReview, currentLabel: string, priorLabel: string | null): string | null {
  const own = result.partOfPeriod && result.current.coveredMonths !== null ? `${currentLabel} counts ${monthSpan(result.current.coveredMonths)} only` : null
  const prior = result.prior
  if (prior === null) {
    return own === null ? null : `${own}, and the ledger holds nothing earlier to compare.`
  }
  if (prior.partial) {
    const held = prior.coveredMonths === null ? `the ledger holds no complete month of ${priorLabel}` : `${priorLabel} has ${monthSpan(prior.coveredMonths)} of those months only`
    return own === null ? `${held.charAt(0).toUpperCase()}${held.slice(1)}, so no change is shown.` : `${own}, and ${held}, so no change is shown.`
  }
  return own === null ? null : `${own}, set against the same months of ${priorLabel}.`
}

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
  const { profitAndLossRows, window, filters } = current
  const period = reviewPeriodOf(filters.period, window)
  const result = periodReview(profitAndLossRows, period, window)
  const months = new Set(result.months.map((month) => month.month))
  const shown = settings.value
  const series = profitAndLossSeries(shown)
  const currentLabel = periodLabel(result.current.period)
  const priorLabel = result.prior === null ? null : periodLabel(result.prior.period)
  const rowOf = (row: CategoryChange, section: 'income' | 'cost' | 'outside') => ({
    key: row.category,
    category: names.value.category(row.category),
    family: displayName(row.family),
    current: row.current?.amount ?? null,
    currentTo: row.current === null ? null : drillLocation(row.current.drill),
    prior: row.prior?.amount ?? null,
    priorTo: row.prior === null ? null : drillLocation(row.prior.drill),
    change: row.change,
    // A cost that rose, or income that fell, is the bad direction. Outside profit and loss has none.
    changeSign: row.change === null || section === 'outside' ? 0 : section === 'cost' ? -row.change : row.change,
  })
  const sectionTitles = { income: shown.bucketLabels.income, cost: 'Costs', outside: 'Outside profit and loss' }
  return {
    period,
    currentLabel,
    priorLabel,
    coverage: coverageSentence(result, currentLabel, priorLabel),
    lines: result.lines.filter((line) => lineShown(shown, line.line)).map((line) => ({
      line: line.line,
      label: lineLabel(shown, line.line),
      emphasised: line.line === 'net' || line.line === 'ownerEarns',
      current: line.current.amount,
      currentTo: drillLocation(line.current.drill),
      prior: line.prior?.amount ?? null,
      priorTo: line.prior === null ? null : drillLocation(line.prior.drill),
      change: line.change,
      changeSign: line.change === null ? 0 : COST_LINES.includes(line.line) ? -line.change : line.change,
    })),
    byMonth: profitAndLossChart(
      monthlyProfitAndLoss(profitAndLossRows, window).filter((month) => months.has(month.month)),
      chartTokens(),
      { series, netLine: MONTHLY_NET },
    ),
    legend: [...profitAndLossLegend(series), { label: MONTHLY_NET.name, colour: 'var(--chart-ink)', mark: 'line' as const }],
    sections: categoryChanges(profitAndLossRows, result.current.range, result.prior, window).map((section) => ({
      key: section.key,
      title: sectionTitles[section.key],
      rows: section.rows.map((row) => rowOf(row, section.key)),
    })),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Period review" description="A year, quarter or custom range against the equal period just before it." />
    <LedgerGate>
      <template v-if="ledger && review">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :presets="['year', 'quarter', 'custom']" :shown-period="review.period" />

        <p v-if="review.coverage" class="flex items-start gap-2 text-sm text-toned" data-testid="review-coverage">
          <UIcon name="i-lucide-calendar-clock" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
          <span>{{ review.coverage }}</span>
        </p>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">Profit and loss</h2>
              <p class="mt-0.5 text-xs text-muted">{{ review.priorLabel ? `Against ${review.priorLabel}` : 'No earlier period to compare' }}</p>
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

          <DrillChartCard
            :chart="review.byMonth"
            title="By month"
            subtitle="Income above zero, costs below it"
            :height="300"
            :phone-height="260"
          >
            <template #legend>
              <ChartLegend :entries="review.legend" />
            </template>
          </DrillChartCard>
        </div>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">By category</h2>
            <p class="mt-0.5 text-xs text-muted">Biggest changes first.</p>
          </header>
          <p v-if="review.sections.length === 0" class="px-5 py-8 text-sm text-muted">No categorised rows in this period.</p>
          <div v-else class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
            <table class="data-table w-full text-sm">
              <template v-for="section in review.sections" :key="section.key">
                <thead>
                  <tr>
                    <th scope="colgroup" class="section-heading text-start">{{ section.title }}</th>
                    <th scope="col" class="hidden text-start sm:table-cell">Family</th>
                    <th scope="col" class="text-end">{{ review.currentLabel }}</th>
                    <th scope="col" class="text-end">{{ review.priorLabel ?? 'Prior period' }}</th>
                    <th scope="col" class="text-end">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in section.rows" :key="row.key">
                    <th scope="row" class="text-start font-normal text-highlighted">{{ row.category }}</th>
                    <td class="hidden text-muted sm:table-cell">{{ row.family }}</td>
                    <td class="text-end">
                      <DrillLink v-if="row.current !== null" :to="row.currentTo" :label="`${row.category}, ${review.currentLabel}, open the rows`">
                        <MoneyText :cents="row.current" precision="whole" />
                      </DrillLink>
                      <span v-else class="text-dimmed">–</span>
                    </td>
                    <td class="text-end">
                      <DrillLink v-if="row.prior !== null" :to="row.priorTo" :label="`${row.category}, ${review.priorLabel}, open the rows`">
                        <MoneyText :cents="row.prior" precision="whole" class="text-muted" />
                      </DrillLink>
                      <span v-else class="text-dimmed">–</span>
                    </td>
                    <td class="text-end">
                      <MoneyText
                        v-if="row.change !== null"
                        :cents="row.change"
                        precision="whole"
                        sign="always"
                        :class="row.changeSign > 0 ? 'text-positive' : row.changeSign < 0 ? 'text-negative' : 'text-muted'"
                      />
                      <span v-else class="text-dimmed">–</span>
                    </td>
                  </tr>
                </tbody>
              </template>
            </table>
          </div>
          <p v-if="review.sections.some((section) => section.key === 'outside')" class="px-4 pb-4 text-xs text-muted sm:px-5">
            Outside profit and loss: reimbursements and other financing settle costs counted above, so they are listed here and left out of
            both directions.
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
