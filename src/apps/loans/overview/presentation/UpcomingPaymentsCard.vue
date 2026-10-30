<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import type { PlannedLoan, UpcomingPayment } from '../domain/loansTogether'
import { bankLoanLink } from './loanLinks'
import { loanBandToken } from './togetherCharts'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The next payments over the bank loans in date order, then a way to each loan's whole plan. */
const props = defineProps<{
  payments: readonly UpcomingPayment[]
  /** The loans in the order the charts colour them. */
  loans: readonly PlannedLoan[]
}>()

function bandOf(payment: UpcomingPayment): string {
  return `var(${loanBandToken(props.loans.findIndex((loan) => loan.loan.id === payment.loan.id))})`
}
</script>

<template>
  <AppCard :title="words.upcoming.title" :subtitle="words.upcoming.subtitle" data-testid="loans-upcoming">
    <p v-if="payments.length === 0" class="px-4 pt-3 type-body sm:px-5">{{ words.upcoming.none }}</p>
    <FigureTable v-else class="mt-2 px-1 sm:px-2" :label="words.upcoming.tableLabel">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.upcoming.due }}</th>
          <th scope="col" class="text-start">{{ words.upcoming.loan }}</th>
          <th scope="col" class="text-end">{{ words.upcoming.youPay }}</th>
          <th scope="col" class="hidden text-end @md:table-cell">{{ words.upcoming.instalment }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="payment in payments" :key="`${payment.loan.id} ${payment.date}`" data-testid="upcoming-payment">
          <th scope="row" class="text-start font-normal text-highlighted">{{ shortDayLabel(payment.date) }}</th>
          <td class="text-start">
            <span class="inline-flex items-center gap-1.5"><span class="swatch swatch-bar" :style="{ '--swatch': bandOf(payment) }" aria-hidden="true" />{{ payment.loan.name }}</span>
          </td>
          <td class="text-end"><MoneyText :cents="payment.yourShare" /></td>
          <td class="hidden text-end @md:table-cell"><MoneyText :cents="payment.payment" /></td>
        </tr>
      </tbody>
    </FigureTable>
    <div class="mt-auto flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 pb-4 sm:px-5">
      <UButton
        v-for="loan in loans"
        :key="loan.loan.id"
        :to="bankLoanLink(loan.loan)"
        :label="words.upcoming.everyPayment(loan.loan.name)"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="link"
        class="px-0"
        data-testid="upcoming-loan-link"
      />
    </div>
  </AppCard>
</template>
