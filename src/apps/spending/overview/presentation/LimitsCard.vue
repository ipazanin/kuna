<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BudgetMonth } from '../../budgets/domain/budgetCarry'
import { words as budgetWords } from '../../budgets/presentation/words'
import type { Category } from '../../workbook/domain/category'
import { SPENDING_BUDGETS_ROUTE } from './spendingLinks'
import { words } from './words'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'
import type { MeterPart } from '../../../../shared/ui/ProgressMeter.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

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

/** A yearly cost before its payment: what is set aside in the category's colour against the amount due, the rest still to set aside as a track. */
function setAsideParts(limit: BudgetMonth, due: Money, colour: string): MeterPart[] {
  return [
    { value: Math.max(limit.available, 0), colour },
    { value: Math.max(due - Math.max(limit.available, 0), 0), colour: 'var(--chart-ghost)' },
  ]
}

const rows = computed(() =>
  props.limits.flatMap((limit) => {
    const category = props.categories.get(limit.category)
    if (category === undefined) return []
    const spent = formatMoney(limit.spent)
    const available = formatMoney(limit.available)
    const colour = `var(${props.colourOf(category)})`
    if (limit.yearly !== undefined && limit.spent <= 0) {
      const due = formatMoney(limit.yearly.amount)
      return [
        {
          limit,
          category,
          caption: words.limits.setAsideOf(available, due),
          label: words.limits.meterSetAside(category.name, available, due),
          parts: setAsideParts(limit, limit.yearly.amount, colour),
          after: words.limits.dueIn(monthLabel(limit.yearly.due)),
        },
      ]
    }
    const debt = limit.available < 0 ? formatMoney(negateMoney(limit.available)) : null
    const caption = limit.yearly !== undefined ? words.limits.paidFromSetAside(spent, available) : debt === null ? words.limits.spentOf(spent, available) : words.limits.spentAfterDebt(spent, debt)
    return [
      {
        limit,
        category,
        caption,
        label: debt === null ? words.limits.meter(category.name, spent, available) : words.limits.meterAfterDebt(category.name, spent, debt),
        parts: meterParts(limit, colour),
        after: words.limits.left(formatMoney(limit.left)),
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
        <NoteLine v-if="row.limit.left < 0" tone="error" data-testid="spending-limit-over">{{ budgetWords.overBy(formatMoney(negateMoney(row.limit.left))) }}</NoteLine>
        <p v-else class="type-caption">{{ row.after }}</p>
      </li>
    </ul>
    <p v-if="note !== null" class="px-4 type-caption sm:px-5" data-testid="spending-limits-unrated">{{ note }}</p>
    <div class="mt-auto px-4 pt-1 pb-4 sm:px-5">
      <UButton :to="SPENDING_BUDGETS_ROUTE" :label="words.limits.allLimits" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="px-0" data-testid="spending-limits-open" />
    </div>
  </AppCard>
</template>
