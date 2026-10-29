<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { bankLoanLink } from './loanLinks'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** A bank loan on the Overview: owed today, the next payment, the subsidy's end, the payoff and the interest, opening the loan's page. */
defineProps<{
  book: BankLoanBook
  /** Null while the plan cannot be worked out. */
  figures: BankLoanFigures | null
}>()
</script>

<template>
  <RouterLink :to="bankLoanLink(book.loan)" class="group block h-full rounded-card" data-testid="loan-card">
    <AppCard as="article" class="h-full gap-3 p-4 transition-colors group-hover:border-accented sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div class="min-w-0">
          <h2 class="text-sm font-medium text-highlighted">{{ book.loan.name }}</h2>
          <p class="text-xs text-muted">{{ book.loan.lender || 'Bank loan' }}</p>
        </div>
        <p v-if="figures !== null" class="text-end">
          <MoneyText :cents="figures.owed" class="text-figure-lg font-semibold text-highlighted" />
          <span class="block text-xs text-muted">owed today</span>
        </p>
      </div>
      <p v-if="figures === null" class="text-sm text-muted">Kuna cannot work out its plan yet. Open it to add the rate from its first instalment.</p>
      <ul v-else class="flex flex-col gap-1 text-sm text-toned">
        <li v-if="figures.next !== null">
          Next on {{ shortDayLabel(figures.next.date) }}: <MoneyText :cents="figures.next.yourShare" class="text-highlighted" />
          <span v-if="figures.next.yourShare !== figures.next.payment" class="text-muted"> of {{ formatMoney(figures.next.payment) }}</span>
        </li>
        <li v-if="figures.subsidy !== null && !figures.subsidy.ended">
          Subsidy ends {{ dayLabel(figures.subsidy.lastCovered) }}<template v-if="figures.subsidy.after !== null">, then {{ formatMoney(figures.subsidy.after) }} a month</template>
        </li>
        <li v-if="figures.payoff !== null">Paid off {{ dayLabel(figures.payoff) }}, {{ formatMoney(figures.interestLeft.interest) }} interest left</li>
        <li>
          {{ formatMoney(figures.interestThisYear.interest) }} interest in {{ figures.interestThisYear.year
          }}<template v-if="figures.interestThisYear.subsidy > 0">, of which the subsidy covers {{ formatMoney(figures.interestThisYear.subsidy) }}</template>
        </li>
      </ul>
    </AppCard>
  </RouterLink>
</template>
