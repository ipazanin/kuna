<script setup lang="ts">
import { computed } from 'vue'

import { monthLabel } from '../../../../shared/calendar/monthLabel'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { words } from './words'

/** One small column per month, every payee on the same scale, so a large payee looks large beside a small one. */
const props = defineProps<{
  cells: readonly { readonly month: MonthKey; readonly amount: number }[]
  /** The largest month of any payee in the table. */
  scale: number
}>()

const HEIGHT = 22

const paidMonths = computed(() => props.cells.filter((cell) => cell.amount > 0).length)
</script>

<template>
  <span class="month-strip" role="img" :aria-label="words.strip(paidMonths, cells.length)">
    <span
      v-for="cell in cells"
      :key="cell.month"
      class="month-cell"
      :class="{ unpaid: cell.amount <= 0 }"
      :style="{ height: `${cell.amount <= 0 || scale <= 0 ? 2 : Math.max(3, Math.round((cell.amount / scale) * HEIGHT))}px` }"
      :title="`${monthLabel(cell.month)}: ${formatMoney(cell.amount)}`"
    />
  </span>
</template>

<style scoped>
.month-strip {
  display: inline-flex;
  height: 22px;
  align-items: flex-end;
  gap: 2px;
}

.month-cell {
  width: 6px;
  border-radius: 1px 1px 0 0;
  background: var(--chart-ink-muted);
}

.month-cell.unpaid {
  background: var(--chart-grid);
}
</style>
