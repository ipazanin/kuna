<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankLoanDialog from '../../bankLoans/presentation/BankLoanDialog.vue'
import { bankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { words as bankWords } from '../../bankLoans/presentation/words'
import InformalLoanDialog from '../../informalLoans/presentation/InformalLoanDialog.vue'
import { informalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import { useLoansBooks } from '../../workbook/application/loansStore'
import BankLoanCard from './BankLoanCard.vue'
import InformalLoanCard from './InformalLoanCard.vue'
import { bankLoanTotals, owedTotals } from './owedTotals'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every loan the Loans file holds, one card each, with tiles over them all once there are two or more. */
const { state } = useLoansBooks()
const day = today()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => (state.choice?.source === 'drive' ? words.empty.onDrive(state.choice.name) : words.empty.inBrowser))

const bankCards = computed(() => (state.workbook?.bankLoans ?? []).map((book) => ({ book, figures: bankLoanFigures(book, day) })))
const informalCards = computed(() => (state.workbook?.informalLoans ?? []).map((book) => ({ book, figures: informalLoanFigures(book, day) })))
const loanCount = computed(() => bankCards.value.length + informalCards.value.length)

const owed = computed(() => owedTotals({ bank: bankCards.value.map((card) => card.figures), informal: informalCards.value.map((card) => card.figures) }))
const bank = computed(() => bankLoanTotals(bankCards.value.map((card) => ({ name: card.book.loan.name, figures: card.figures }))))

/** Names the payer when every subsidised loan has the same one. */
const interestCaption = computed(() => {
  const subsidy = bank.value?.interestThisYear.subsidy ?? 0
  if (subsidy <= 0) return ''
  const payers = new Set(bankCards.value.flatMap((card) => (card.book.loan.subsidy === null ? [] : [card.book.loan.subsidy.payer])))
  const [payer] = payers
  return payers.size === 1 && payer !== undefined ? bankWords.tiles.interestCovered(bankWords.subsidyPays(payer), formatMoney(subsidy)) : words.tiles.subsidiesPay(formatMoney(subsidy))
})

const addingBank = ref(false)
const addingInformal = ref(false)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description">
      <template v-if="loanCount > 0" #actions>
        <UButton :label="words.addBankLoan" icon="i-lucide-landmark" color="neutral" variant="outline" data-testid="add-bank-loan" @click="addingBank = true" />
        <UButton :label="words.addInformalLoan" icon="i-lucide-handshake" color="neutral" variant="outline" data-testid="add-informal-loan" @click="addingInformal = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="loans-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState v-if="loanCount === 0" icon="i-lucide-landmark" :title="words.empty.title" data-testid="loans-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
        </template>
        <template #actions>
          <div class="flex flex-col items-center gap-4">
            <div class="flex flex-wrap justify-center gap-2">
              <UButton :label="words.addBankLoan" icon="i-lucide-landmark" data-testid="add-bank-loan" @click="addingBank = true" />
              <UButton :label="words.addInformalLoan" icon="i-lucide-handshake" color="neutral" variant="outline" data-testid="add-informal-loan" @click="addingInformal = true" />
            </div>
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else>
        <DashboardGrid v-if="loanCount >= 2" layout="tiles" data-testid="loans-tiles">
          <KpiTile
            :label="words.tiles.owedInAll"
            :value="formatMoney(owed.owed)"
            :caption="owed.owedToYou > 0 ? plural(words.tiles.owedToYou(loanCount, formatMoney(owed.owedToYou)), loanCount) : plural(words.tiles.onLoans(loanCount), loanCount)"
            :to="null"
            data-testid="loans-total"
          />
          <KpiTile
            v-if="bank?.next"
            :label="words.tiles.nextPayment"
            :value="formatMoney(bank.next.yourShare)"
            :caption="words.tiles.nextOn(shortDayLabel(bank.next.date), bank.next.name)"
            :to="null"
          />
          <KpiTile
            v-if="bank"
            :label="words.tiles.interestIn(bank.interestThisYear.year)"
            :value="formatMoney(bank.interestThisYear.interest)"
            :caption="interestCaption"
            :definition="words.tiles.interestDefinition"
            :to="null"
          />
          <KpiTile
            v-if="bank?.lastPayoff"
            :label="words.tiles.paidOff"
            :value="monthLabel(monthOf(bank.lastPayoff))"
            :caption="informalCards.length > 0 ? words.tiles.noEndDate : dayLabel(bank.lastPayoff)"
            :to="null"
          />
        </DashboardGrid>
        <UAlert
          v-if="state.workbook.problems.length > 0"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="plural(words.problems.title(state.workbook.problems.length), state.workbook.problems.length)"
          data-testid="loans-problems"
        >
          <template #description>
            <ul class="flex flex-col gap-0.5">
              <li v-for="problem in state.workbook.problems" :key="`${problem.kind} ${problem.label} ${problem.reason}`">{{ problem.kind }} "{{ problem.label }}": {{ problem.reason }}</li>
            </ul>
          </template>
        </UAlert>
        <DashboardGrid data-testid="loan-cards">
          <BankLoanCard v-for="card in bankCards" :key="card.book.loan.id" :book="card.book" :figures="card.figures" :day="day" :hero="loanCount === 1" />
          <InformalLoanCard v-for="card in informalCards" :key="card.book.loan.id" :book="card.book" :figures="card.figures" :day="day" :hero="loanCount === 1" />
        </DashboardGrid>
      </template>
    </template>
    <BankLoanDialog v-model:open="addingBank" :book="null" />
    <InformalLoanDialog v-model:open="addingInformal" :book="null" />
  </section>
</template>
