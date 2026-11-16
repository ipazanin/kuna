<script setup lang="ts">
import { computed } from 'vue'

import { categoryColours } from '../../categories/presentation/categoryColours'
import type { Category } from '../../workbook/domain/category'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** The parts a receipt or you split an entry into, each with its category's colour and its amount, and under each what the `line` slot holds, such as its labels in the entry dialog, which then sits nearer its own part than the next. Built of spans, so it fits inside a row's button. */
const props = defineProps<{
  lines: readonly TransactionItem[]
  categories: readonly Category[]
  currency: CurrencyCode
}>()

const colours = computed(() => categoryColours(props.categories))
const shown = computed(() =>
  props.lines.map((line) => {
    const category = props.categories.find((candidate) => candidate.id === line.category)
    return {
      line,
      name: [category?.name ?? '', line.note].filter((part) => part !== '').join(' · '),
      colour: category === undefined ? 'var(--chart-deemphasis)' : `var(${colours.value(category)})`,
    }
  }),
)
</script>

<template>
  <span class="flex flex-col pt-1" :class="$slots.line === undefined ? 'gap-0.5' : 'gap-3'" data-testid="spending-row-lines">
    <span v-for="{ line, name, colour } in shown" :key="line.id" class="flex flex-col gap-1">
      <span class="flex items-center gap-2 type-caption" data-testid="spending-row-line">
        <span class="size-1.5 shrink-0 rounded-full" :style="{ background: colour }" aria-hidden="true" />
        <span class="min-w-0 flex-1 break-words">{{ name }}</span>
        <AccountMoneyText :cents="line.amount" :currency="currency" tone="flow" class="shrink-0" />
      </span>
      <span v-if="$slots.line !== undefined" class="flex ps-3.5"><slot name="line" :line="line" :title="name" /></span>
    </span>
  </span>
</template>
