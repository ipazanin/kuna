<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import BankLoanDialog from '../../bankLoans/presentation/BankLoanDialog.vue'
import { words as bankWords } from '../../bankLoans/presentation/words'
import InformalLoanDialog from '../../informalLoans/presentation/InformalLoanDialog.vue'
import { DIRECTION_LOOKS } from '../../directions/presentation/loanDirection'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { debtFreeOn, interestAfter, interestInYear, plannedLoans, upcomingPayments } from '../domain/loansTogether'
import BankLoanCard from './BankLoanCard.vue'
import CompletedLoansCard from './CompletedLoansCard.vue'
import InformalLoanCard from './InformalLoanCard.vue'
import LoansTogether from './LoansTogether.vue'
import { directionCaption, loansOverview } from './loansOverview'
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
 * Every loan the Loans file holds, one card each, the loans at zero apart under Completed. With two or
 * more open loans, tiles lead: what you owe, what is owed to you and the net of the two, then the bank
 * loans' figures, which are all yours to pay. With two or more bank loans, charts and the upcoming payments over
 * the bank loans follow.
 */
const { state } = useLoansBooks()
const day = today()
const year = yearOf(day)

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => (state.choice?.source === 'drive' ? words.empty.onDrive(state.choice.name) : words.empty.inBrowser))
const problemLines = computed(() => (state.workbook?.problems ?? []).map((problem) => words.problems.line(problem.noun, problem.label, problem.reason)))

const overview = computed(() => loansOverview(state.workbook ?? { bankLoans: [], informalLoans: [] }, day))
const loanCount = computed(() => (state.workbook?.bankLoans.length ?? 0) + (state.workbook?.informalLoans.length ?? 0))
const openCount = computed(() => overview.value.openBank.length + overview.value.openInformal.length)
const netLook = computed(() => (overview.value.net.direction === null ? null : DIRECTION_LOOKS[overview.value.net.direction]))
const planned = computed(() => plannedLoans(state.workbook?.bankLoans ?? []))
const next = computed(() => upcomingPayments(planned.value, day)[0] ?? null)
const interestThisYear = computed(() => interestInYear(planned.value, year))
const interestLeft = computed(() => interestAfter(planned.value, day))
const unplanned = computed(() => (state.workbook?.bankLoans.length ?? 0) - planned.value.length)
const debtFree = computed(() => debtFreeOn(state.workbook?.bankLoans ?? []))
const owingInformally = computed(() => overview.value.openInformal.some((card) => card.figures.owedByYou > 0))
const youOwe = DIRECTION_LOOKS['you-owe']
const owedToYou = DIRECTION_LOOKS['owed-to-you']

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
        <DashboardGrid v-if="openCount >= 2" layout="tiles" data-testid="loans-directions">
          <KpiTile
            :label="youOwe.label"
            :value="formatMoney(overview.totals.owed)"
            :caption="directionCaption(overview, 'you-owe')"
            :icon="youOwe.icon"
            :icon-tone="youOwe.tone"
            :to="null"
            data-testid="loans-you-owe"
          />
          <KpiTile
            :label="owedToYou.label"
            :value="formatMoney(overview.totals.owedToYou)"
            :caption="directionCaption(overview, 'owed-to-you')"
            :icon="owedToYou.icon"
            :icon-tone="owedToYou.tone"
            :to="null"
            data-testid="loans-owed-to-you"
          />
          <KpiTile
            :label="words.tiles.net"
            :value="formatMoney(overview.net.amount)"
            :caption="overview.net.direction === null ? words.tiles.netEven : overview.net.direction === 'you-owe' ? words.tiles.netYouOwe : words.tiles.netOwedToYou"
            icon="i-lucide-scale"
            :icon-tone="netLook?.tone"
            :to="null"
            data-testid="loans-net"
          />
        </DashboardGrid>
        <DashboardGrid v-if="openCount >= 2 && planned.length > 0" layout="tiles" data-testid="loans-tiles">
          <KpiTile v-if="next" :label="words.tiles.nextPayment" :value="formatMoney(next.yourShare)" :caption="words.tiles.nextOn(shortDayLabel(next.date), next.loan.name)" :to="null" />
          <KpiTile
            :label="words.tiles.interestIn(year)"
            :value="formatMoney(interestThisYear.interest)"
            :caption="interestCaption(interestThisYear.subsidy)"
            :definition="words.tiles.interestDefinition"
            :to="null"
          />
          <KpiTile
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
        <DashboardGrid v-if="openCount > 0" data-testid="loan-cards">
          <BankLoanCard v-for="card in overview.openBank" :key="card.book.loan.id" :book="card.book" :figures="card.figures" :day="day" :hero="openCount === 1" />
          <InformalLoanCard v-for="card in overview.openInformal" :key="card.book.loan.id" :card="card" :day="day" :hero="openCount === 1" />
        </DashboardGrid>
        <EmptyState v-else icon="i-lucide-circle-check" :title="words.completed.allClosed" :description="words.completed.allClosedDescription" data-testid="loans-all-closed" />
        <CompletedLoansCard v-if="overview.completed.length > 0" :loans="overview.completed" />
      </template>
    </template>
    <BankLoanDialog v-model:open="addingBank" :book="null" />
    <InformalLoanDialog v-model:open="addingInformal" :book="null" />
  </section>
</template>
