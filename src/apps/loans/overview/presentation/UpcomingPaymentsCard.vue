<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { PlannedLoan, UpcomingPayment } from '../domain/loansTogether'
import { bankLoanLink, informalLoanLink } from './loanLinks'
import { loanBandToken } from './togetherCharts'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The next payments over the bank loans and the plans of informal loans you owe in date order, then a way to each loan's page. */
const props = defineProps<{
  payments: readonly UpcomingPayment[]
  /** The loans in the order the charts colour them. */
  loans: readonly PlannedLoan[]
}>()

function bandOf(loan: PlannedLoan['loan']): string {
  return `var(${loanBandToken(props.loans.findIndex((planned) => planned.loan.id === loan.id))})`
}

/** The informal loans the list shows a payment of, in the order they first come. */
const informalLoans = computed(() => {
  const seen = new Map<string, InformalLoan>()
  for (const payment of props.payments) if (payment.kind === 'informal') seen.set(payment.loan.id, payment.loan)
  return [...seen.values()]
})

const links = computed(() => [
  ...props.loans.map((planned) => ({ key: planned.loan.id, name: planned.loan.name, to: bankLoanLink(planned.loan) })),
  ...informalLoans.value.map((loan) => ({ key: loan.id, name: loan.name, to: informalLoanLink(loan) })),
])
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
        <tr v-for="payment in payments" :key="`${payment.loan.id} ${payment.date} ${payment.kind === 'informal' && payment.overdue}`" data-testid="upcoming-payment">
          <th scope="row" class="text-start font-normal text-highlighted">
            <span v-if="payment.kind === 'informal' && payment.overdue" class="text-warning">{{ words.upcoming.overdue }}</span>
            <template v-else>{{ shortDayLabel(payment.date) }}</template>
          </th>
          <td class="text-start">
            <span v-if="payment.kind === 'bank'" class="inline-flex items-center gap-1.5"
              ><span class="swatch swatch-bar" :style="{ '--swatch': bandOf(payment.loan) }" aria-hidden="true" />{{ payment.loan.name }}</span
            >
            <span v-else class="inline-flex items-start gap-1.5" data-testid="upcoming-informal">
              <UIcon name="i-lucide-handshake" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {{ payment.loan.name }}
                <span class="block type-caption">{{ words.card.youOweName(payment.loan.counterparty) }}</span>
              </span>
            </span>
          </td>
          <td class="text-end"><MoneyText :cents="payment.yourShare" /></td>
          <td class="hidden text-end @md:table-cell"><MoneyText :cents="payment.payment" /></td>
        </tr>
      </tbody>
    </FigureTable>
    <div class="mt-auto flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 pb-4 sm:px-5">
      <UButton
        v-for="link in links"
        :key="link.key"
        :to="link.to"
        :label="words.upcoming.everyPayment(link.name)"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="link"
        class="px-0"
        data-testid="upcoming-loan-link"
      />
    </div>
  </AppCard>
</template>
