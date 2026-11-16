<script setup lang="ts">
import { computed } from 'vue'

import type { EntryFilters } from './useEntryFilters'
import { words } from './words'
import { partTotals } from '../../analytics/domain/partTotals'
import TotalsLines from '../../analytics/presentation/TotalsLines.vue'
import { partsInEvent } from '../../events/domain/eventMembership'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { labelTotals } from '../../labels/domain/labelTotals'
import { euroRows } from '../../rates/domain/euroRows'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import { negateMoney } from '../../../../shared/money/money'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/**
 * What the picked event and the picked label count, with the split by group, from the same totals as the Events and Labels
 * screens, never from the rows listed under the other filters.
 */
const props = defineProps<{
  filters: EntryFilters
}>()

const { state } = useSpendingBooks()
const rates = useRates()

const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const categories = computed(() => state.workbook?.categories ?? [])

const lines = computed(() => {
  const book = state.workbook
  const event = props.filters.pickedEvent
  const label = props.filters.pickedLabel
  if (book === null || (event === null && label === null)) return []
  const rows = euroRows(book, everydayRates(rates.value))
  const entries = (count: number): string => plural(words.filters.entries(count), count)
  const byId = new Map(book.categories.map((category) => [category.id, category]))
  return [
    ...(event === null
      ? []
      : [partTotals(rows, byId, partsInEvent(book.events, event.id))].map((totals) => ({ key: event.id, heading: `${event.name} · ${dayRangeLabel(event.days)} · ${entries(totals.rows)}`, totals }))),
    ...(label === null ? [] : labelTotals(rows, book.categories, [label]).map((totals) => ({ key: label.id, heading: `${label.name} · ${entries(totals.rows)}`, totals }))),
  ]
})
</script>

<template>
  <div v-if="lines.length > 0" class="flex flex-col gap-4 px-4 pb-4 sm:px-5" data-testid="spending-filter-totals">
    <div v-for="line in lines" :key="line.key" class="flex flex-col gap-1.5" data-testid="spending-filter-total">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="min-w-0 type-label break-words">{{ line.heading }}</h3>
        <MoneyText v-if="line.totals.rows > 0" :cents="negateMoney(line.totals.spent)" tone="flow" :data-spent="line.totals.spent" class="shrink-0 type-figure-secondary" />
      </div>
      <TotalsLines v-if="line.totals.rows > 0" :totals="line.totals" :categories="categories" :rated="!waiting" />
    </div>
  </div>
</template>
