<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
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
import { capitalised } from '../../../../shared/text/capitalised'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** A year, quarter or custom range against the equal period just before it. */
const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

/** Costs read positive, so a fall in one of them is the good direction. */
const COST_LINES: readonly ProfitAndLossLine[] = ['operating', 'taxes', 'ownerPay', 'cost']

/** "Jan – Sep 2026" within a year, "Jun 2025 – Feb 2026" across one. */
function monthSpan(months: { readonly from: MonthKey; readonly to: MonthKey }): string {
  if (months.from === months.to) return monthLabel(months.from)
  return words.monthSpan(months.from, months.to, months.from.slice(0, 4) === months.to.slice(0, 4))
}

/** One sentence on what is compared, when the ledger leaves out part of either period. Null when both are whole. */
function coverageSentence(result: PeriodReview, currentLabel: string, priorLabel: string | null): string | null {
  const own = result.partOfPeriod && result.current.coveredMonths !== null ? words.coverage.countsOnly(currentLabel, monthSpan(result.current.coveredMonths)) : null
  const prior = result.prior
  if (prior === null) {
    return own === null ? null : words.coverage.nothingEarlier(own)
  }
  if (prior.partial) {
    const held = prior.coveredMonths === null ? words.coverage.noCompleteMonth(priorLabel ?? '') : words.coverage.hasOnly(priorLabel ?? '', monthSpan(prior.coveredMonths))
    return own === null ? words.coverage.noChange(capitalised(held)) : words.coverage.bothNoChange(own, held)
  }
  return own === null ? null : words.coverage.sameMonths(own, priorLabel ?? '')
}

function periodLabel(period: ReviewPeriod): string {
  switch (period.preset) {
    case 'year':
      return words.period.year(period.year)
    case 'quarter':
      return words.period.quarter(period.quarter, period.year)
    case 'custom':
      return words.period.custom(period.range.from, period.range.to)
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
  const sectionTitles = { income: shown.bucketLabels.income, cost: words.costs, outside: words.outside }
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
    lines: result.lines
      .filter((line) => lineShown(shown, line.line))
      .map((line) => ({
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
    categoriesSummary: categoryCount === 0 ? words.noCategorisedRows : plural(words.categoriesSummary(categoryCount, sections.map((section) => section.title.toLowerCase()).join(', ')), categoryCount),
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
      <UIcon name="i-lucide-calendar-clock" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>{{ review.coverage }}</span>
    </p>

    <DashboardGrid layout="pair">
      <AppCard :title="words.profitAndLoss" :subtitle="review.priorLabel ? words.against(review.priorLabel) : words.noEarlierPeriod">
        <FigureTable class="px-1 pt-2 pb-2 sm:px-2">
          <thead>
            <tr>
              <th scope="col" class="text-start">{{ words.line }}</th>
              <th scope="col" class="text-end">{{ review.currentLabel }}</th>
              <th scope="col" class="text-end">{{ review.priorLabel ?? words.priorPeriod }}</th>
              <th scope="col" class="hidden text-end @sm:table-cell">{{ words.change }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in review.lines" :key="line.line">
              <th scope="row" class="cell-wraps text-start" :class="line.emphasised ? 'font-medium text-highlighted' : 'font-normal text-toned'">
                {{ line.label }}
                <MoneyText
                  v-if="line.change !== null"
                  :cents="line.change"
                  sign="always"
                  class="block text-xs font-normal @sm:hidden"
                  :class="line.changeSign > 0 ? 'text-success' : line.changeSign < 0 ? 'text-error' : 'text-muted'"
                />
              </th>
              <td class="text-end">
                <DrillLink :to="line.currentTo" :label="words.openRows(line.label, review.currentLabel)">
                  <MoneyText :cents="line.current" />
                </DrillLink>
              </td>
              <td class="text-end">
                <DrillLink v-if="line.prior !== null" :to="line.priorTo" :label="words.openRows(line.label, review.priorLabel ?? '')">
                  <MoneyText :cents="line.prior" class="text-muted" />
                </DrillLink>
                <span v-else class="text-muted">{{ words.noData }}</span>
              </td>
              <td class="hidden text-end @sm:table-cell">
                <MoneyText v-if="line.change !== null" :cents="line.change" sign="always" :class="line.changeSign > 0 ? 'text-success' : line.changeSign < 0 ? 'text-error' : 'text-muted'" />
                <span v-else class="text-muted">–</span>
              </td>
            </tr>
          </tbody>
        </FigureTable>
      </AppCard>

      <AppCard :title="words.byCategory" :subtitle="words.biggestFirst" collapse-id="analysis.compare-categories" :summary="review.categoriesSummary">
        <p v-if="review.sections.length === 0" class="px-5 py-8 text-sm text-muted">{{ words.noCategorisedRowsSentence }}</p>
        <FigureTable v-else class="px-1 pt-2 pb-2 sm:px-2">
          <template v-for="section in shownSections" :key="section.key">
            <thead>
              <tr>
                <th scope="colgroup" class="section-heading text-start">{{ section.title }}</th>
                <th scope="col" class="hidden text-start @2xl:table-cell">{{ words.family }}</th>
                <th scope="col" class="text-end">{{ review.currentLabel }}</th>
                <th scope="col" class="text-end">{{ review.priorLabel ?? words.priorPeriod }}</th>
                <th scope="col" class="hidden text-end @md:table-cell">{{ words.change }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in section.rows" :key="row.key">
                <th scope="row" class="cell-wraps text-start font-normal text-highlighted">
                  {{ row.category }}
                  <MoneyText
                    v-if="row.change !== null"
                    :cents="row.change"
                    sign="always"
                    class="block text-xs @md:hidden"
                    :class="row.changeSign > 0 ? 'text-success' : row.changeSign < 0 ? 'text-error' : 'text-muted'"
                  />
                </th>
                <td class="hidden text-muted @2xl:table-cell">{{ row.family }}</td>
                <td class="text-end">
                  <DrillLink v-if="row.current !== null" :to="row.currentTo" :label="words.openRows(row.category, review.currentLabel)">
                    <MoneyText :cents="row.current" />
                  </DrillLink>
                  <span v-else class="text-muted">–</span>
                </td>
                <td class="text-end">
                  <DrillLink v-if="row.prior !== null" :to="row.priorTo" :label="words.openRows(row.category, review.priorLabel ?? '')">
                    <MoneyText :cents="row.prior" class="text-muted" />
                  </DrillLink>
                  <span v-else class="text-muted">–</span>
                </td>
                <td class="hidden text-end @md:table-cell">
                  <MoneyText v-if="row.change !== null" :cents="row.change" sign="always" :class="row.changeSign > 0 ? 'text-success' : row.changeSign < 0 ? 'text-error' : 'text-muted'" />
                  <span v-else class="text-muted">–</span>
                </td>
              </tr>
            </tbody>
          </template>
        </FigureTable>
        <ShowAllButton v-if="review.categoryCount > FIRST_SHOWN" v-model:expanded="showAllCategories" :total="review.categoryCount" class="px-4 pb-4 sm:px-5" />
        <p v-if="review.sections.some((section) => section.key === 'outside')" class="px-4 pb-4 text-xs text-muted sm:px-5">
          {{ words.outsideNote }}
        </p>
      </AppCard>
    </DashboardGrid>
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
