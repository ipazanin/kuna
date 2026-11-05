<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { BudgetMonth } from '../../budgets/domain/budgetCarry'
import { words as budgetWords } from '../../budgets/presentation/words'
import type { Category } from '../../workbook/domain/category'
import { SPENDING_BUDGETS_ROUTE } from './spendingLinks'
import { words } from './words'
import { negateMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'
import type { MeterPart } from '../../../../shared/ui/ProgressMeter.vue'

/** Each limited category of the month, what it spent against what it has available, with a way to Limits. */
const props = defineProps<{
  limits: readonly BudgetMonth[]
  /** Why some rows count as nothing, or null when every row counts. */
  note: string | null
  categories: ReadonlyMap<RecordId, Category>
  colourOf: (category: Category) => string
}>()

/**
 * What was spent within what is available in the category's colour, any overspend in the error tone, and what is left
 * as a track. A month that starts below zero shows the debt it carried in grey before this month's spending.
 */
function meterParts(limit: BudgetMonth, colour: string): MeterPart[] {
  if (limit.available < 0) {
    return [
      { value: -limit.available, colour: 'var(--chart-deemphasis)' },
      { value: Math.max(limit.spent, 0), colour: 'var(--tone-negative)' },
    ]
  }
  return [
    { value: Math.max(Math.min(limit.spent, limit.available), 0), colour },
    { value: Math.max(-limit.left, 0), colour: 'var(--tone-negative)' },
    { value: Math.max(limit.left, 0), colour: 'var(--chart-ghost)' },
  ]
}

const rows = computed(() =>
  props.limits.flatMap((limit) => {
    const category = props.categories.get(limit.category)
    if (category === undefined) return []
    const spent = formatMoney(limit.spent)
    const available = formatMoney(limit.available)
    const debt = limit.available < 0 ? formatMoney(negateMoney(limit.available)) : null
    return [
      {
        limit,
        category,
        caption: debt === null ? words.limits.spentOf(spent, available) : words.limits.spentAfterDebt(spent, debt),
        label: debt === null ? words.limits.meter(category.name, spent, available) : words.limits.meterAfterDebt(category.name, spent, debt),
        parts: meterParts(limit, `var(${props.colourOf(category)})`),
      },
    ]
  }),
)
</script>

<template>
  <AppCard :title="words.limits.title" data-testid="spending-limits">
    <ul class="flex flex-col gap-4 px-4 pt-3 pb-2 sm:px-5">
      <li v-for="row in rows" :key="row.limit.category" class="flex flex-col gap-1.5" data-testid="spending-limit">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <span class="min-w-0 type-body text-highlighted">{{ row.category.name }}</span>
          <span class="figure type-caption">{{ row.caption }}</span>
        </div>
        <ProgressMeter :parts="row.parts" :label="row.label" :height="8" />
        <p v-if="row.limit.left < 0" class="inline-flex items-center gap-1.5 type-caption text-error" data-testid="spending-limit-over">
          <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" aria-hidden="true" />
          {{ budgetWords.overBy(formatMoney(negateMoney(row.limit.left))) }}
        </p>
        <p v-else class="type-caption">{{ words.limits.left(formatMoney(row.limit.left)) }}</p>
      </li>
    </ul>
    <p v-if="note !== null" class="px-4 type-caption sm:px-5" data-testid="spending-limits-unrated">{{ note }}</p>
    <div class="mt-auto px-4 pt-1 pb-4 sm:px-5">
      <UButton :to="SPENDING_BUDGETS_ROUTE" :label="words.limits.allLimits" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="px-0" data-testid="spending-limits-open" />
    </div>
  </AppCard>
</template>
