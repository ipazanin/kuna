<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface LoanRepaymentLine {
  readonly key: string
  readonly date: string
  readonly applied: number
  readonly to: RouteLocationRaw | null
}

export interface LoanLine {
  readonly key: string
  readonly lentOn: string
  /** The payment it is a part of, when the loan is the owner's part of a split company payment. */
  readonly part: string | null
  readonly amount: number
  readonly remaining: number
  readonly open: boolean
  readonly repaidOn: string | null
  readonly to: RouteLocationRaw | null
  readonly repayments: readonly LoanRepaymentLine[]
}
</script>

<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'

import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'

/** Each loan to the owner, newest first, with the repayments the matching gave it. */
defineProps<{
  loans: readonly LoanLine[]
  /** What the card says when no loan is listed, such as "No loan to the owner had a balance in 2025." */
  empty: string
}>()
</script>

<template>
  <p v-if="loans.length === 0" class="py-6 text-sm text-muted" data-testid="loan-list-empty">{{ empty }}</p>
  <ul v-else class="flex flex-col" data-testid="loan-list">
    <li v-for="loan in loans" :key="loan.key" class="loan-row">
      <div class="loan-head">
        <DrillLink :to="loan.to" :label="`Loan of ${loan.lentOn}, open the row`" class="text-highlighted">
          <span class="text-sm">{{ loan.lentOn }}</span>
        </DrillLink>
        <MoneyText :cents="loan.amount" precision="whole" class="text-sm font-medium text-highlighted" />
        <UBadge
          :label="loan.open ? 'Open' : 'Repaid'"
          :color="loan.open ? 'warning' : 'success'"
          variant="subtle"
          size="sm"
          class="justify-self-start"
        />
        <p class="loan-remaining text-xs text-muted">
          <template v-if="loan.open">
            <MoneyText :cents="loan.remaining" precision="whole" class="text-toned" /> still owed
          </template>
          <template v-else-if="loan.repaidOn">Closed {{ loan.repaidOn }}</template>
          <template v-else>Nothing lent on this row</template>
        </p>
      </div>
      <p v-if="loan.part !== null" class="truncate text-xs text-muted">{{ loan.part }}</p>
      <ol v-if="loan.repayments.length > 0" class="loan-trail" :aria-label="`Repayments matched to the loan of ${loan.lentOn}`">
        <li v-for="repayment in loan.repayments" :key="repayment.key">
          <DrillLink :to="repayment.to" :label="`Repayment of ${repayment.date}, open the row`" class="loan-share">
            <span class="text-muted">{{ repayment.date }}</span>
            <MoneyText :cents="repayment.applied" precision="whole" class="text-toned" />
          </DrillLink>
        </li>
      </ol>
    </li>
  </ul>
</template>

<style scoped>
.loan-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem 0;
}

.loan-row + .loan-row {
  border-top: 1px solid var(--border-default);
}

.loan-head {
  display: grid;
  grid-template-columns: minmax(6.5rem, auto) 5.5rem 4.75rem minmax(0, 1fr);
  align-items: center;
  column-gap: 0.75rem;
}

.loan-remaining {
  text-align: end;
}

.loan-trail {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
}

.loan-share {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-control);
  background: var(--surface-elevated);
  font-size: 0.75rem;
}

@media (max-width: 639px) {
  .loan-head {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.125rem;
  }

  .loan-remaining {
    text-align: start;
  }
}
</style>
