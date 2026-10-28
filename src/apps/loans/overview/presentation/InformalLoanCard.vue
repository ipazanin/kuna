<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { MOVEMENT_KIND_NAMES, whoOwes } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { informalLoanLink } from './loanLinks'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** An informal loan on the Overview: who owes how much, and the last movement, opening the loan's page. */
defineProps<{
  book: InformalLoanBook
  figures: InformalLoanFigures
}>()
</script>

<template>
  <RouterLink :to="informalLoanLink(book.loan)" class="group block h-full rounded-card" data-testid="loan-card">
    <AppCard as="article" class="h-full gap-3 p-4 transition-colors group-hover:border-accented sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div class="min-w-0">
          <h2 class="text-sm font-medium text-highlighted">{{ book.loan.name }}</h2>
          <p class="text-xs text-muted">{{ book.loan.counterparty || 'Informal loan' }}</p>
        </div>
        <p class="text-end">
          <MoneyText :cents="Math.abs(figures.owedByYou)" class="text-figure-lg font-semibold text-highlighted" />
          <span class="block text-xs text-muted">{{ whoOwes(figures.owedByYou).toLowerCase() }}</span>
        </p>
      </div>
      <ul class="flex flex-col gap-1 text-sm text-toned">
        <li v-if="figures.last !== null">
          Last on {{ dayLabel(figures.last.date) }}: {{ MOVEMENT_KIND_NAMES[figures.last.kind].toLowerCase() }} {{ formatMoney(figures.last.amount) }}
        </li>
        <li v-else>No movements since it started on {{ dayLabel(book.loan.start) }}</li>
        <li class="text-muted">No interest and no fixed plan</li>
      </ul>
    </AppCard>
  </RouterLink>
</template>
