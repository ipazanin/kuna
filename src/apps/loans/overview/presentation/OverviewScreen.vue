<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankLoanDialog from '../../bankLoans/presentation/BankLoanDialog.vue'
import { bankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { words as bankWords } from '../../bankLoans/presentation/words'
import InformalLoanDialog from '../../informalLoans/presentation/InformalLoanDialog.vue'
import { informalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { debtFreeOn, interestAfter, interestInYear, plannedLoans, upcomingPayments } from '../domain/loansTogether'
import BankLoanCard from './BankLoanCard.vue'
import InformalLoanCard from './InformalLoanCard.vue'
import LoansTogether from './LoansTogether.vue'
import { owedTotals } from './owedTotals'
import { words } from './words'
import { today, yearOf } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * Every loan the Loans file holds, one card each. With two or more loans, tiles over them all lead,
 * and with two or more bank loans, charts and the upcoming payments over the bank loans follow.
 */
const { state } = useLoansBooks()
const day = today()
const year = yearOf(day)

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => (state.choice?.source === 'drive' ? words.empty.onDrive(state.choice.name) : words.empty.inBrowser))
const problemLines = computed(() => (state.workbook?.problems ?? []).map((problem) => words.problems.line(problem.noun, problem.label, problem.reason)))

const bankCards = computed(() => (state.workbook?.bankLoans ?? []).map((book) => ({ book, figures: bankLoanFigures(book, day) })))
const informalCards = computed(() => (state.workbook?.informalLoans ?? []).map((book) => ({ book, figures: informalLoanFigures(book, day) })))
const loanCount = computed(() => bankCards.value.length + informalCards.value.length)

const owed = computed(() => owedTotals({ bank: bankCards.value.map((card) => card.figures), informal: informalCards.value.map((card) => card.figures) }))
const planned = computed(() => plannedLoans(state.workbook?.bankLoans ?? []))
const next = computed(() => upcomingPayments(planned.value, day)[0] ?? null)
const interestThisYear = computed(() => interestInYear(planned.value, year))
const interestLeft = computed(() => interestAfter(planned.value, day))
const unplanned = computed(() => (state.workbook?.bankLoans.length ?? 0) - planned.value.length)
const debtFree = computed(() => debtFreeOn(state.workbook?.bankLoans ?? []))
const owingInformally = computed(() => informalCards.value.some((card) => card.figures.owedByYou > 0))

/** What an interest figure leaves out, or else what subsidies pay of it, naming the payer when every subsidised loan has the same one. */
function interestCaption(subsidy: Money): string {
  if (unplanned.value > 0) return plural(words.tiles.withoutUnplanned(unplanned.value), unplanned.value)
  if (subsidy <= 0) return ''
  const payers = new Set(planned.value.flatMap((book) => (book.loan.subsidy === null ? [] : [book.loan.subsidy.payer])))
  const [payer] = payers
  return payers.size === 1 && payer !== undefined ? bankWords.tiles.interestCovered(bankWords.subsidyPays(payer), formatMoney(subsidy)) : words.tiles.subsidiesPay(formatMoney(subsidy))
}

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
          <KpiTile v-if="next" :label="words.tiles.nextPayment" :value="formatMoney(next.yourShare)" :caption="words.tiles.nextOn(shortDayLabel(next.date), next.loan.name)" :to="null" />
          <KpiTile
            v-if="planned.length > 0"
            :label="words.tiles.interestIn(year)"
            :value="formatMoney(interestThisYear.interest)"
            :caption="interestCaption(interestThisYear.subsidy)"
            :definition="words.tiles.interestDefinition"
            :to="null"
          />
          <KpiTile
            v-if="planned.length > 0"
            :label="words.tiles.interestLeft"
            :value="formatMoney(interestLeft.interest)"
            :caption="interestCaption(interestLeft.subsidy)"
            :definition="words.tiles.interestLeftDefinition"
            :to="null"
            data-testid="loans-interest-left"
          />
          <KpiTile
            v-if="debtFree"
            :label="owingInformally ? words.tiles.paidOff : words.tiles.freeOfDebt"
            :value="monthLabel(monthOf(debtFree))"
            :caption="owingInformally ? words.tiles.noEndDate : dayLabel(debtFree)"
            :to="null"
            data-testid="loans-debt-free"
          />
        </DashboardGrid>
        <RecordProblemsAlert
          v-if="state.workbook.problems.length > 0"
          :title="plural(words.problems.title(state.workbook.problems.length), state.workbook.problems.length)"
          :lines="problemLines"
          data-testid="loans-problems"
        />
        <LoansTogether v-if="planned.length >= 2" :loans="planned" :day="day" :free-of-debt-on="owingInformally ? null : debtFree" />
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
