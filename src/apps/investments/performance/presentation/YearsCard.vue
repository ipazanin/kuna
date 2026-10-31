<script setup lang="ts">
import { computed } from 'vue'

import type { YearPerformance } from '../domain/portfolioPerformance'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { formatPercent, formatPercentChange } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'

/**
 * Each calendar year's time-weighted return beside the benchmark's, with its largest fall and its volatility. A narrow
 * card keeps four columns and moves the difference and the volatility under the figures they belong with.
 */
const props = defineProps<{
  years: readonly YearPerformance[]
  today: CivilDate
}>()

const text = words.years
const DASH = '–'

const rows = computed(() =>
  [...props.years].reverse().map(({ year, performance }) => {
    const soFar = year === yearOf(props.today)
    if (performance.kind !== 'figures') {
      return { year, soFar, belowZero: false, nothingHeld: false, figures: null }
    }
    const comparison = performance.benchmark
    return {
      year,
      soFar,
      belowZero: performance.belowZeroOn !== null,
      nothingHeld: performance.nothingHeld && comparison !== null,
      figures: {
        yours: performance.portfolio.timeWeighted === null ? DASH : formatPercentChange(performance.portfolio.timeWeighted.total),
        benchmark: comparison === null ? DASH : formatPercentChange(comparison.priceReturn.total),
        difference: comparison === null || comparison.difference === null ? DASH : formatPercentChange(comparison.difference),
        largestFall: performance.largestFall === null ? DASH : formatPercentChange(performance.largestFall),
        volatility: performance.volatility === null ? DASH : formatPercent(performance.volatility),
      },
    }
  }),
)

/** Why a year shows dashes: too few monthly returns for a volatility, a value below zero, or nothing held. */
const notes = computed(() => [
  ...(rows.value.some((row) => row.figures?.volatility === DASH) ? [text.noVolatility] : []),
  ...(rows.value.some((row) => row.belowZero) ? [text.belowZero] : []),
  ...(rows.value.some((row) => row.nothingHeld) ? [text.nothingHeld] : []),
])
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" collapse-id="investments.performance.years" :summary="plural(text.summary(years.length), years.length)" data-testid="performance-years">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.year }}</th>
          <th scope="col" class="text-end">{{ text.yours }}</th>
          <th scope="col" class="text-end">{{ text.benchmark }}</th>
          <th scope="col" class="hidden text-end @md:table-cell">{{ text.difference }}</th>
          <th scope="col" class="text-end">{{ text.largestFall }}</th>
          <th scope="col" class="hidden text-end @md:table-cell">{{ text.volatility }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.year" data-testid="performance-year">
          <th scope="row" class="cell-wraps text-start font-normal">
            <span class="text-toned">{{ row.year }}</span>
            <span v-if="row.soFar" class="block type-caption">{{ text.soFar }}</span>
          </th>
          <template v-if="row.figures !== null">
            <td class="figure text-end">{{ row.figures.yours }}</td>
            <td class="cell-wraps text-end">
              <span class="figure">{{ row.figures.benchmark }}</span>
              <span v-if="row.figures.difference !== DASH" class="block type-caption @md:hidden">{{ text.differenceOf(row.figures.difference) }}</span>
            </td>
            <td class="figure hidden text-end @md:table-cell">{{ row.figures.difference }}</td>
            <td class="cell-wraps text-end">
              <span class="figure">{{ row.figures.largestFall }}</span>
              <span v-if="row.figures.volatility !== DASH" class="block type-caption @md:hidden">{{ text.volatilityOf(row.figures.volatility) }}</span>
            </td>
            <td class="figure hidden text-end @md:table-cell">{{ row.figures.volatility }}</td>
          </template>
          <td v-else colspan="5" class="text-end text-muted">{{ text.noFigures }}</td>
        </tr>
      </tbody>
    </FigureTable>
    <ul v-if="notes.length > 0" class="flex flex-col gap-1 px-4 pb-4 type-caption sm:px-5" data-testid="performance-years-notes">
      <li v-for="note in notes" :key="note">{{ note }}</li>
    </ul>
  </AppCard>
</template>
