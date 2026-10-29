<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankLoanDialog from '../../bankLoans/presentation/BankLoanDialog.vue'
import { bankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import InformalLoanDialog from '../../informalLoans/presentation/InformalLoanDialog.vue'
import { informalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import { useLoansBooks } from '../../workbook/application/loansStore'
import BankLoanCard from './BankLoanCard.vue'
import InformalLoanCard from './InformalLoanCard.vue'
import { today } from '../../../../shared/calendar/civilDate'
import { ZERO, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'

/** Every loan the Loans file holds, one card each, with what you owe in all above them. */
const { state } = useLoansBooks()
const day = today()

const where = computed(() => (state.choice?.source === 'drive' ? `on Google Drive as ${state.choice.name}` : 'in this browser'))

const bankCards = computed(() => (state.workbook?.bankLoans ?? []).map((book) => ({ book, figures: bankLoanFigures(book, day) })))
const informalCards = computed(() => (state.workbook?.informalLoans ?? []).map((book) => ({ book, figures: informalLoanFigures(book, day) })))
const empty = computed(() => bankCards.value.length === 0 && informalCards.value.length === 0)

/** What you owe over every loan, and apart from it what others owe you on informal loans. */
const totals = computed(() => {
  const owed: Money[] = [...bankCards.value.map((card) => card.figures?.owed ?? ZERO), ...informalCards.value.map((card) => card.figures.owedByYou)]
  return {
    owed: sumMoney(owed.filter((amount) => amount > 0)),
    owedToYou: sumMoney(owed.filter((amount) => amount < 0).map(negateMoney)),
  }
})

const addingBank = ref(false)
const addingInformal = ref(false)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Overview">
      <template v-if="state.workbook !== null" #actions>
        <UButton label="Add bank loan" icon="i-lucide-landmark" color="neutral" variant="outline" data-testid="add-bank-loan" @click="addingBank = true" />
        <UButton label="Add informal loan" icon="i-lucide-handshake" color="neutral" variant="outline" data-testid="add-informal-loan" @click="addingInformal = true" />
      </template>
    </PageHeader>
    <template v-if="state.workbook !== null">
      <AppCard v-if="empty">
        <div class="flex flex-col gap-1 px-4 py-6 sm:px-5" data-testid="loans-empty">
          <p class="text-base font-medium text-highlighted">No loans yet</p>
          <p class="text-sm text-muted">Your Loans file is ready, kept {{ where }}. Add a bank loan from its contract, or an informal loan between people.</p>
        </div>
      </AppCard>
      <template v-else>
        <p class="text-sm text-toned" data-testid="loans-total">
          You owe <MoneyText :cents="totals.owed" class="font-semibold text-highlighted" /> in all<template v-if="totals.owedToYou > 0"
            >, and <MoneyText :cents="totals.owedToYou" class="font-semibold text-highlighted" /> is owed to you</template
          >.
        </p>
        <UAlert
          v-if="state.workbook.problems.length > 0"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="state.workbook.problems.length === 1 ? 'A record in the Loans file is left out or doubted' : `${state.workbook.problems.length} records in the Loans file are left out or doubted`"
          data-testid="loans-problems"
        >
          <template #description>
            <ul class="flex flex-col gap-0.5">
              <li v-for="problem in state.workbook.problems" :key="`${problem.kind} ${problem.label} ${problem.reason}`">{{ problem.kind }} "{{ problem.label }}": {{ problem.reason }}</li>
            </ul>
          </template>
        </UAlert>
        <div class="grid gap-4 md:grid-cols-2" data-testid="loan-cards">
          <BankLoanCard v-for="card in bankCards" :key="card.book.loan.id" :book="card.book" :figures="card.figures" />
          <InformalLoanCard v-for="card in informalCards" :key="card.book.loan.id" :book="card.book" :figures="card.figures" />
        </div>
      </template>
    </template>
    <BankLoanDialog v-model:open="addingBank" :book="null" />
    <InformalLoanDialog v-model:open="addingInformal" :book="null" />
  </section>
</template>
