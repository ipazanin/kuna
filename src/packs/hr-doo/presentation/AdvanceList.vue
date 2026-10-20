<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface AdvanceRepaymentLine {
  readonly key: string
  readonly date: string
  readonly applied: number
  readonly to: RouteLocationRaw | null
}

export interface AdvanceLine {
  readonly key: string
  readonly paidOn: string
  readonly description: string
  readonly category: string
  readonly amount: number
  /** The advance on Transactions. */
  readonly to: RouteLocationRaw | null
  readonly remaining: number
  readonly open: boolean
  readonly repaidOn: string | null
  readonly repayments: readonly AdvanceRepaymentLine[]
}
</script>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'

import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'

/** Each cost the owner paid privately, newest first, with the reimbursements the matching gave it. */
defineProps<{
  advances: readonly AdvanceLine[]
}>()
</script>

<template>
  <p v-if="advances.length === 0" class="py-6 text-sm text-muted">No cost the owner paid is on the owner-advances tab yet.</p>
  <ul v-else class="flex flex-col" data-testid="advance-list">
    <li v-for="advance in advances" :key="advance.key" class="advance-row">
      <div class="advance-head">
        <div class="min-w-0">
          <p class="truncate text-sm text-highlighted">{{ advance.description || advance.category }}</p>
          <p class="truncate text-xs text-muted">{{ advance.paidOn }}, {{ advance.category }}</p>
        </div>
        <DrillLink :to="advance.to" :label="`Advance of ${advance.paidOn}, open the row`" class="text-end">
          <MoneyText :cents="advance.amount" precision="whole" class="text-sm font-medium text-highlighted" />
        </DrillLink>
        <UBadge :label="advance.open ? 'Owed to the owner' : 'Reimbursed'" :color="advance.open ? 'warning' : 'success'" variant="subtle" size="sm" class="justify-self-start" />
        <p class="advance-remaining text-xs text-muted">
          <template v-if="advance.open"><MoneyText :cents="advance.remaining" precision="whole" class="text-toned" /> still owed</template>
          <template v-else-if="advance.repaidOn">Reimbursed {{ advance.repaidOn }}</template>
        </p>
      </div>
      <ol v-if="advance.repayments.length > 0" class="advance-trail" :aria-label="`Reimbursements matched to the advance of ${advance.paidOn}`">
        <li v-for="repayment in advance.repayments" :key="repayment.key">
          <DrillLink :to="repayment.to" :label="`Reimbursement of ${repayment.date}, open the row`" class="advance-share">
            <span class="text-muted">{{ repayment.date }}</span>
            <MoneyText :cents="repayment.applied" precision="whole" class="text-toned" />
          </DrillLink>
        </li>
      </ol>
    </li>
  </ul>
</template>

<style scoped>
.advance-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem 0;
}

.advance-row + .advance-row {
  border-top: 1px solid var(--border-default);
}

.advance-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.5rem 8.5rem minmax(0, 0.8fr);
  align-items: center;
  column-gap: 0.75rem;
}

.advance-remaining {
  text-align: end;
}

.advance-trail {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.advance-share {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
  font-size: 0.75rem;
}

@media (max-width: 639px) {
  .advance-head {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.25rem;
  }

  .advance-remaining {
    text-align: start;
  }
}
</style>
