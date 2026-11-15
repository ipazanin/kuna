<script setup lang="ts">
import { computed } from 'vue'

import { words } from './words'
import type { PartTotals } from '../domain/partTotals'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { unratedNote } from '../../rates/presentation/unratedNote'
import type { Category } from '../../workbook/domain/category'
import { formatMoney } from '../../../../shared/money/moneyFormat'

/**
 * The lines under what some parts spent, such as a label's or an event's: each group of spending categories with its swatch, what
 * they received and saved, and how many rows the rates do not reach yet.
 */
const props = defineProps<{
  totals: PartTotals
  categories: readonly Category[]
  /** Whether the rates are in, so rows they do not reach are worth a line. */
  rated: boolean
}>()

const groups = computed(() => {
  const byId = new Map(props.categories.map((category) => [category.id, category]))
  const colourOf = categoryColours(props.categories)
  return props.totals.groups.flatMap(({ group, spent }) => {
    const category = byId.get(group)
    return category === undefined ? [] : [{ id: group, name: category.name, spent: formatMoney(spent), colour: `var(${colourOf(category)})` }]
  })
})

const others = computed(() => [
  ...(props.totals.income === 0 ? [] : [words.lines.received(formatMoney(props.totals.income))]),
  ...(props.totals.saved === 0 ? [] : [words.lines.saved(formatMoney(props.totals.saved))]),
  ...(props.rated ? [unratedNote(props.totals.unrated)].filter((note) => note !== null) : []),
])
</script>

<template>
  <span v-if="groups.length > 0 || others.length > 0" class="flex flex-col gap-0.5">
    <span v-for="group in groups" :key="group.id" class="flex items-center gap-2 type-caption" data-testid="spending-group-line">
      <span class="size-1.5 shrink-0 rounded-full" :style="{ background: group.colour }" aria-hidden="true" />
      <span class="min-w-0 flex-1 break-words">{{ group.name }}</span>
      <span class="figure shrink-0">{{ group.spent }}</span>
    </span>
    <span v-for="other in others" :key="other" class="type-caption">{{ other }}</span>
  </span>
</template>
