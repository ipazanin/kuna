<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { monthLabel, shortMonthName } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { useFilters } from '../../filters/application/filterStore'
import { useSettings } from '../../settings/application/useSettings'
import { lineLabel, lineShown } from '../../settings/domain/profitAndLossLabels'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import type { ProfitAndLossLine } from '../../workbook/domain/bucketTotals'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { displayName } from '../../workbook/domain/displayName'
import { categoryChanges } from '../domain/categoryChanges'
import type { CategoryChange } from '../domain/categoryChanges'
import { periodReview, reviewPeriodOf } from '../domain/periodReview'
import type { PeriodReview, ReviewPeriod } from '../domain/periodReview'

/** A year, quarter or custom range against the equal period just before it. */
const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

/** Costs read positive, so a fall in one of them is the good direction. */
const COST_LINES: readonly ProfitAndLossLine[] = ['operating', 'taxes', 'ownerPay', 'cost']

/** "Jan – Sept 2026" within a year, "Jun 2025 – Feb 2026" across one. */
function monthSpan(months: { readonly from: MonthKey; readonly to: MonthKey }): string {
  if (months.from === months.to) return monthLabel(months.from)
  const sameYear = months.from.slice(0, 4) === months.to.slice(0, 4)
  return `${sameYear ? shortMonthName(months.from) : monthLabel(months.from)} – ${monthLabel(months.to)}`
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
      return `${dayLabel(period.range.from)} to ${dayLabel(period.range.to)}`
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
  const shown = settings.value
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
  const sections = categoryChanges(profitAndLossRows, result.current.range, result.prior, window).map((section) => ({
    key: section.key,
    title: sectionTitles[section.key],
    rows: section.rows.map((row) => rowOf(row, section.key)),
  }))
  const categoryCount = sections.reduce((count, section) => count + section.rows.length, 0)
  return {
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
    sections,
    categoryCount,
    categoriesSummary:
      categoryCount === 0
        ? 'No categorised rows in this period'
        : `${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}, under ${sections.map((section) => section.title.toLowerCase()).join(', ')}`,
  }
})

const showAllCategories = ref(false)

/** The sections cut to their first ten rows in all, until Show all. */
const shownSections = computed(() => {
  const sections = review.value?.sections ?? []
  if (showAllCategories.value) return sections
  let left = FIRST_SHOWN
  return sections.flatMap((section) => {
    const rows = section.rows.slice(0, left)
    left -= rows.length
    return rows.length === 0 ? [] : [{ ...section, rows }]
  })
})
</script>

<template>
  <div v-if="review" class="flex flex-col gap-6">
    <p v-if="review.coverage" class="flex items-start gap-2 text-sm text-toned" data-testid="review-coverage">
      <UIcon name="i-lucide-calendar-clock" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
      <span>{{ review.coverage }}</span>
    </p>

    <div class="wide-pair">
      <AppCard title="Profit and loss" :subtitle="review.priorLabel ? `Against ${review.priorLabel}` : 'No earlier period to compare'">
        <div class="@container relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
          <table class="data-table w-full text-sm">
            <thead>
              <tr>
                <th scope="col" class="text-start">Line</th>
                <th scope="col" class="text-end">{{ review.currentLabel }}</th>
                <th scope="col" class="text-end">{{ review.priorLabel ?? 'Prior period' }}</th>
                <th scope="col" class="hidden text-end @sm:table-cell">Change</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in review.lines" :key="line.line">
                <th scope="row" class="cell-wraps text-start" :class="line.emphasised ? 'font-medium text-highlighted' : 'font-normal text-toned'">
                  {{ line.label }}
                  <MoneyText
                    v-if="line.change !== null"
                    :cents="line.change"
                    precision="whole"
                    sign="always"
                    class="block text-xs font-normal @sm:hidden"
                    :class="line.changeSign > 0 ? 'text-positive' : line.changeSign < 0 ? 'text-negative' : 'text-muted'"
                  />
                </th>
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
                <td class="hidden text-end @sm:table-cell">
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
      </AppCard>

      <AppCard title="By category" subtitle="Biggest changes first." collapse-id="analysis.compare-categories" :summary="review.categoriesSummary">
        <p v-if="review.sections.length === 0" class="px-5 py-8 text-sm text-muted">No categorised rows in this period.</p>
        <div v-else class="@container relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
          <table class="data-table w-full text-sm">
            <template v-for="section in shownSections" :key="section.key">
              <thead>
                <tr>
                  <th scope="colgroup" class="section-heading text-start">{{ section.title }}</th>
                  <th scope="col" class="hidden text-start @2xl:table-cell">Family</th>
                  <th scope="col" class="text-end">{{ review.currentLabel }}</th>
                  <th scope="col" class="text-end">{{ review.priorLabel ?? 'Prior period' }}</th>
                  <th scope="col" class="hidden text-end @md:table-cell">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in section.rows" :key="row.key">
                  <th scope="row" class="cell-wraps text-start font-normal text-highlighted">
                    {{ row.category }}
                    <MoneyText
                      v-if="row.change !== null"
                      :cents="row.change"
                      precision="whole"
                      sign="always"
                      class="block text-xs @md:hidden"
                      :class="row.changeSign > 0 ? 'text-positive' : row.changeSign < 0 ? 'text-negative' : 'text-muted'"
                    />
                  </th>
                  <td class="hidden text-muted @2xl:table-cell">{{ row.family }}</td>
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
                  <td class="hidden text-end @md:table-cell">
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
        <ShowAllButton v-if="review.categoryCount > FIRST_SHOWN" v-model:expanded="showAllCategories" :total="review.categoryCount" class="px-4 pb-4 sm:px-5" />
        <p v-if="review.sections.some((section) => section.key === 'outside')" class="px-4 pb-4 text-xs text-muted sm:px-5">
          Outside profit and loss: reimbursements and other financing settle costs counted above, so they are listed here and left out of
          both directions.
        </p>
      </AppCard>
    </div>
  </div>
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
