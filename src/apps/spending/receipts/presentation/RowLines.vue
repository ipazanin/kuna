<script setup lang="ts">
import { computed } from 'vue'

import { categoryColours } from '../../categories/presentation/categoryColours'
import type { Category } from '../../workbook/domain/category'
import type { ReceiptLine } from '../../workbook/domain/receiptLine'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** What a receipt split an entry into, each line with its category's colour and its amount. Built of spans, so it fits inside a row's button. */
const props = defineProps<{
  lines: readonly ReceiptLine[]
  categories: readonly Category[]
  currency: CurrencyCode
}>()

const colours = computed(() => categoryColours(props.categories))
const shown = computed(() =>
  props.lines.map((line) => {
    const category = props.categories.find((candidate) => candidate.id === line.category)
    return {
      line,
      name: [category?.name ?? '', line.text].filter((part) => part !== '').join(' · '),
      colour: category === undefined ? 'var(--chart-deemphasis)' : `var(${colours.value(category)})`,
    }
  }),
)
</script>

<template>
  <span class="flex flex-col gap-0.5 pt-1" data-testid="spending-row-lines">
    <span v-for="{ line, name, colour } in shown" :key="line.id" class="flex items-center gap-2 type-caption" data-testid="spending-row-line">
      <span class="size-1.5 shrink-0 rounded-full" :style="{ background: colour }" aria-hidden="true" />
      <span class="min-w-0 flex-1 break-words">{{ name }}</span>
      <AccountMoneyText :cents="line.amount" :currency="currency" sign="always" tone="flow" class="shrink-0" />
    </span>
  </span>
</template>
