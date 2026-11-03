<script setup lang="ts">
import { computed, ref } from 'vue'

import { monthlyReturns } from '../domain/monthlyReturns'
import type { ReturnAgainstIndex } from '../domain/monthlyReturns'
import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { returnFill } from './returnFill'
import type { ReturnSpan } from './returnFill'
import { words } from './words'
import { monthKey, monthNumber } from '../../../../shared/calendar/monthKey'
import { shortMonthName } from '../../../../shared/calendar/monthLabel'
import { formatPercentChange } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'

/**
 * Every month's time-weighted return since the first deposit as a grid of years by months, each cell tinted by how
 * far it rose or fell, with the signed figure in it. Against the index shows the return less the benchmark's.
 */
const props = defineProps<{
  /** Everything, from the first deposit. */
  performance: PeriodPerformance
  /** The benchmark's name while the line compares with it. */
  benchmarkName: string | null
  /** Whether a benchmark is chosen at all. */
  benchmarkChosen: boolean
}>()

type View = 'yours' | 'against'

const text = words.months
const view = ref<View>('yours')
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

const growth = computed(() => props.performance.growth)
const years = computed(() => monthlyReturns(growth.value).reverse())
const compared = computed(() => props.benchmarkName !== null && growth.value.length > 1 && growth.value.every((point) => point.benchmark !== null))
const shown = computed((): View => (compared.value ? view.value : 'yours'))
const views = computed(() => [
  { value: 'yours' as const, label: text.yours },
  { value: 'against' as const, label: text.againstIndex },
])

interface Cell {
  readonly text: string
  readonly fill: string | null
}

const rows = computed(() =>
  years.value.map((year) => {
    const byMonth = new Map(year.months.map((month) => [monthNumber(month.month), month]))
    return {
      year: year.year,
      months: MONTHS.map((month) => {
        const found = byMonth.get(month)
        return found === undefined ? null : cellOf(found, 'month')
      }),
      whole: cellOf(year, 'year'),
    }
  }),
)

function cellOf(figures: ReturnAgainstIndex, span: ReturnSpan): Cell {
  const share = shown.value === 'yours' ? figures.portfolio : figures.gap
  if (share === null) {
    return { text: '–', fill: null }
  }
  return { text: formatPercentChange(share), fill: returnFill(share, span) }
}
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" collapse-id="investments.performance.months" :summary="plural(text.summary(years.length), years.length)" data-testid="performance-months">
    <EmptyState
      v-if="years.length === 0"
      class="mx-4 mb-4 sm:mx-5"
      icon="i-lucide-calendar"
      :title="performance.belowZeroOn === null ? text.emptyTitle : text.belowZeroTitle"
      :description="performance.belowZeroOn === null ? text.emptyDescription : text.belowZeroDescription"
    />
    <template v-else>
      <div class="flex flex-col gap-2 px-4 pt-1 sm:px-5">
        <ChoiceButtons v-if="compared" v-model="view" :options="views" :label="text.view" data-testid="performance-months-view" />
        <p v-if="shown === 'against' && benchmarkName !== null" class="type-caption">{{ text.gapNote(benchmarkName) }}</p>
        <p v-else-if="!benchmarkChosen" class="type-caption">{{ text.noIndex }}</p>
      </div>
      <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
        <thead>
          <tr>
            <td />
            <th scope="col" class="text-end">{{ text.year }}</th>
            <th v-for="month in MONTHS" :key="month" scope="col" class="text-end">{{ shortMonthName(monthKey(2000, month)) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.year" data-testid="performance-months-year">
            <th scope="row" class="text-start font-normal text-toned">{{ row.year }}</th>
            <td class="figure text-end font-semibold text-default" :class="row.whole.fill">{{ row.whole.text }}</td>
            <td v-for="(cell, index) in row.months" :key="index" class="figure text-end text-default" :class="cell?.fill">{{ cell?.text }}</td>
          </tr>
        </tbody>
      </FigureTable>
    </template>
  </AppCard>
</template>
