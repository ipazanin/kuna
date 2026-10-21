<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { addDays } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import { listedRowKey } from '../../../features/workbook/domain/splits'
import type { UnaccountedReimbursement } from '../domain/ownerAdvances'
import type { AdvancePrefill } from './AddAdvanceDialog.vue'

/** Payments to the owner that no cost on the owner-advances tab accounts for, newest first, each with a way to add its cost. */
const props = defineProps<{
  payments: readonly UnaccountedReimbursement[]
  /** Off while another write runs. */
  editable: boolean
}>()

const emit = defineEmits<{
  addCost: [prefill: AdvancePrefill]
}>()

const { drillLocation } = useFilters()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function day(date: CivilDate): string {
  return dayFormat.format(new Date(date))
}

/** The cost is dated the day before the payment that reimbursed it, for the amount the payment left unaccounted. */
function addCost(line: UnaccountedReimbursement): void {
  emit('addCost', { date: addDays(line.payment.date, -1), amount: line.amount, description: line.payment.description })
}
</script>

<template>
  <ul class="flex flex-col" data-testid="unaccounted-reimbursements">
    <li v-for="line in [...props.payments].reverse()" :key="listedRowKey(line.payment)" class="payment-row" data-testid="unaccounted-reimbursement">
      <div class="min-w-0">
        <p class="truncate text-sm text-highlighted">{{ line.payment.description || line.payment.counterparty || 'Reimbursement' }}</p>
        <p class="truncate text-xs text-muted">
          Paid {{ day(line.payment.date) }}<template v-if="line.amount !== -line.payment.amount">, <MoneyText :cents="line.amount" /> of <MoneyText :cents="-line.payment.amount" /></template>
        </p>
      </div>
      <DrillLink :to="drillLocation(line.drill)" :label="`Reimbursement of ${day(line.payment.date)}, open the row`" class="text-end">
        <MoneyText :cents="line.amount" class="text-sm font-medium text-highlighted" />
      </DrillLink>
      <UButton
        label="Add the cost"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        class="justify-self-end"
        :disabled="!editable"
        :aria-label="`Add the cost the reimbursement of ${day(line.payment.date)} repaid`"
        data-testid="add-unaccounted-cost"
        @click="addCost(line)"
      />
    </li>
  </ul>
</template>

<style scoped>
.payment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: 0.75rem;
  padding: 0.5rem 0;
}

.payment-row + .payment-row {
  border-top: 1px solid var(--border-default);
}

@media (max-width: 639px) {
  .payment-row {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.25rem;
  }

  .payment-row > :last-child {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
