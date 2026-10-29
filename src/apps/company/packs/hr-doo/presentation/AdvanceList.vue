<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { RecordId } from '../../../../../shared/storage/domain/recordId'

export interface AdvanceRepaymentLine {
  readonly key: string
  readonly date: string
  readonly applied: number
  readonly to: RouteLocationRaw | null
}

export interface AdvanceLine {
  /** The advance's own id on its tab. */
  readonly id: RecordId
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
import UButton from '@nuxt/ui/components/Button.vue'

import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'

/** Each cost the owner paid privately, newest first, with the reimbursements the matching gave it. */
defineProps<{
  advances: readonly AdvanceLine[]
  /** What the card says when no cost is listed, such as "No cost the owner paid privately was owed in 2025." */
  empty: string
  /** True while another write runs. */
  busy: boolean
}>()

const emit = defineEmits<{
  edit: [id: RecordId]
}>()
</script>

<template>
  <p v-if="advances.length === 0" class="py-6 text-sm text-muted" data-testid="advance-list-empty">{{ empty }}</p>
  <ul v-else class="flex flex-col" data-testid="advance-list">
    <li v-for="advance in advances" :key="advance.id" class="advance-row">
      <div class="advance-head">
        <div class="min-w-0">
          <p class="truncate text-sm text-highlighted">{{ advance.description || advance.category }}</p>
          <p class="truncate text-xs text-muted">{{ advance.paidOn }}, {{ advance.category }}</p>
        </div>
        <DrillLink :to="advance.to" :label="`Advance of ${advance.paidOn}, open the row`" class="text-end">
          <MoneyText :cents="advance.amount" class="text-sm font-medium text-highlighted" />
        </DrillLink>
        <UBadge :label="advance.open ? 'Owed to the owner' : 'Reimbursed'" :color="advance.open ? 'warning' : 'success'" variant="subtle" size="sm" class="justify-self-start" />
        <p class="advance-remaining text-xs text-muted">
          <template v-if="advance.open"><MoneyText :cents="advance.remaining" class="text-toned" /> still owed</template>
          <template v-else-if="advance.repaidOn">Reimbursed {{ advance.repaidOn }}</template>
        </p>
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="advance-edit"
          :disabled="busy"
          :aria-label="`Change or delete the advance of ${advance.paidOn}`"
          data-testid="advance-edit"
          @click="emit('edit', advance.id)"
        />
      </div>
      <ol v-if="advance.repayments.length > 0" class="advance-trail" :aria-label="`Reimbursements matched to the advance of ${advance.paidOn}`">
        <li v-for="repayment in advance.repayments" :key="repayment.key">
          <DrillLink :to="repayment.to" :label="`Reimbursement of ${repayment.date}, open the row`" class="advance-share">
            <span class="text-muted">{{ repayment.date }}</span>
            <MoneyText :cents="repayment.applied" class="text-toned" />
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
  grid-template-columns: minmax(0, 1fr) 5.5rem 8.5rem minmax(0, 0.8fr) auto;
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
    grid-template-columns: minmax(0, 1fr) auto auto;
    row-gap: 0.25rem;
  }

  .advance-edit {
    grid-column: 3;
    grid-row: 1 / span 2;
    min-width: 2.75rem;
    min-height: 2.75rem;
    justify-content: center;
  }

  .advance-remaining {
    grid-column: 1 / span 2;
    text-align: start;
  }
}
</style>
