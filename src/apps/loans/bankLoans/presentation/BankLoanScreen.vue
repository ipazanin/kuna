<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { subsidyLastCovered } from '../domain/loanFigures'
import { fractionOf } from '../domain/yearlyRate'
import { balanceChart } from '../../balances/presentation/balanceChart'
import { words as balanceWords } from '../../balances/presentation/words'
import { bankLoanNamed, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import BalanceHero from './BalanceHero.vue'
import BankLoanDialog from './BankLoanDialog.vue'
import BankLoanTiles from './BankLoanTiles.vue'
import { bankLoanFigures, bankLoanMonths, planYears } from './bankLoanView'
import ChangeListCard from './ChangeListCard.vue'
import type { ChangeLine } from './ChangeListCard.vue'
import ExtraPaymentDialog from './ExtraPaymentDialog.vue'
import type { ExtraPaymentStart } from './ExtraPaymentDialog.vue'
import LateInstalmentDialog from './LateInstalmentDialog.vue'
import PaymentsCard from './PaymentsCard.vue'
import PlanCard from './PlanCard.vue'
import RatePeriodDialog from './RatePeriodDialog.vue'
import SubsidyDialog from './SubsidyDialog.vue'
import WhatIfPanel from './WhatIfPanel.vue'
import { words } from './words'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { daysBetween, today, yearOf } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** One bank loan: what is owed and paid back, its balance over time, where its payments go, what an extra payment would do, its plan, and what changes it. */
const { state } = useLoansBooks()
const route = useRoute()
const day = today()

const book = computed(() => (state.workbook === null ? null : bankLoanNamed(state.workbook, route.query.loan)))
const figures = computed(() => (book.value === null ? null : bankLoanFigures(book.value, day)))
const years = computed(() => (book.value === null ? [] : planYears(book.value, day)))
const payer = computed(() => book.value?.loan.subsidy?.payer ?? '')
const phone = usePhoneLayout()
const estimateFrom = computed(() => years.value.flatMap((year) => year.lines).find((line) => line.estimate)?.date ?? null)
const chart = computed(() => {
  if (book.value === null) return null
  return balanceChart(bankLoanMonths(book.value), monthOf(day), chartTokens(), phone.value, {
    extraPayments: book.value.extraPayments.map((payment) => monthOf(payment.date)),
    estimateFrom: estimateFrom.value === null ? null : monthOf(estimateFrom.value),
  })
})
/** The current year, or the plan's nearest year to it before the loan starts or after it ends. */
const openYear = computed(() => {
  const current = yearOf(day)
  const [first] = years.value
  const last = years.value.at(-1)
  if (first === undefined || last === undefined || years.value.some((year) => year.year === current)) return current
  return current < first.year ? first.year : last.year
})

const rateLines = computed((): ChangeLine[] =>
  (book.value?.ratePeriods ?? []).map((period) => ({
    key: period.id,
    title: words.changes.rate(formatRate(fractionOf(period.rate)), words.changes.rateTypes[period.rateType]),
    detail: words.changes.rateDetail(dayLabel(period.from), period.note),
  })),
)
const subsidyLines = computed((): ChangeLine[] => {
  const loan = book.value?.loan
  const subsidy = loan?.subsidy ?? null
  const lastCovered = loan === undefined ? null : subsidyLastCovered(loan)
  if (subsidy === null || lastCovered === null) return []
  return [
    {
      key: 'subsidy',
      title: words.changes.subsidyMonthly(formatMoney(subsidy.monthly)),
      detail: words.changes.subsidyDetail(words.subsidyPays(subsidy.payer), subsidy.firstInstalment, subsidy.firstInstalment + subsidy.instalments - 1, dayLabel(lastCovered)),
    },
  ]
})
const extraLines = computed((): ChangeLine[] =>
  [...(book.value?.extraPayments ?? [])]
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
    .map((payment) => ({ key: payment.id, title: formatMoney(payment.amount), detail: words.changes.extraDetail(dayLabel(payment.date), payment.effect) })),
)
const lateLines = computed((): ChangeLine[] =>
  [...(book.value?.lateInstalments ?? [])]
    .sort((earlier, later) => earlier.due.localeCompare(later.due))
    .map((late) => {
      const days = daysBetween(late.due, late.paid)
      return { key: late.id, title: words.changes.due(dayLabel(late.due)), detail: plural(words.status.paidLate(days, dayLabel(late.paid)), days) }
    }),
)

const editingLoan = ref(false)
const subsidyOpen = ref(false)
const rateOpen = ref(false)
const editingRate = ref<RatePeriod | null>(null)
const extraOpen = ref(false)
const extraStart = ref<ExtraPaymentStart | null>(null)
const lateOpen = ref(false)
const editingLate = ref<LateInstalment | null>(null)

function openRate(key: string | null): void {
  editingRate.value = book.value?.ratePeriods.find((period) => period.id === key) ?? null
  rateOpen.value = true
}

function openExtra(start: ExtraPaymentStart | null): void {
  extraStart.value = start
  extraOpen.value = true
}

function changeExtra(key: string): void {
  const payment = book.value?.extraPayments.find((entry) => entry.id === key)
  if (payment !== undefined) openExtra({ date: payment.date, amount: payment.amount, effect: payment.effect, editing: payment })
}

function openLate(key: string | null): void {
  editingLate.value = book.value?.lateInstalments.find((late) => late.id === key) ?? null
  lateOpen.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <UButton :to="LOANS_OVERVIEW_ROUTE" :label="words.allLoans" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-loans" />
    <template v-if="book !== null">
      <PageHeader
        :title="book.loan.name"
        :description="[book.loan.lender, plural(words.terms(book.loan.instalments, formatMoney(book.loan.principal)), book.loan.instalments)].filter((part) => part !== '').join(', ')"
      >
        <template #actions>
          <UButton :label="words.changeLoan" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="bank-loan-edit" @click="editingLoan = true" />
        </template>
      </PageHeader>
      <UAlert v-if="figures === null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.noPlanTitle" :description="words.noPlan(dayLabel(book.loan.firstInstalment))" />
      <template v-else>
        <BalanceHero :loan="book.loan" :figures="figures" />
        <BankLoanTiles :figures="figures" :payer="payer" />
        <DashboardGrid layout="pair">
          <ChartCard
            v-if="chart !== null"
            :title="words.balance.title"
            :subtitle="words.balance.subtitle"
            :option="chart.option"
            :description="chart.description"
            :height="280"
            :phone-height="220"
            data-testid="loan-balance-chart"
          >
            <template #legend>
              <ChartLegend
                :entries="[
                  { label: balanceWords.owedSoFar, colour: 'var(--loan-principal)', mark: 'line' },
                  { label: balanceWords.stillToCome, colour: 'var(--loan-ahead)', mark: 'dashed' },
                ]"
              />
            </template>
          </ChartCard>
          <PaymentsCard v-if="book.plan !== null" :plan="book.plan" :current-year="yearOf(day)" :estimate-from-year="estimateFrom === null ? null : yearOf(estimateFrom)" :payer="payer" />
        </DashboardGrid>
        <WhatIfPanel :book="book" :default-date="figures.next?.date ?? day" @apply="openExtra" />
        <PlanCard :years="years" :open-year="openYear" :has-subsidy="book.loan.subsidy !== null" />
      </template>
      <DashboardGrid layout="pair">
        <ChangeListCard
          :title="words.changes.ratePeriods"
          :subtitle="words.changes.ratePeriodsSubtitle"
          :lines="rateLines"
          :empty="words.changes.noRatePeriod"
          :add-label="words.changes.addRate"
          collapse-id="loans.rate-periods"
          data-testid="rate-periods"
          @add="openRate(null)"
          @change="openRate"
        />
        <ChangeListCard
          :title="words.changes.subsidy"
          :subtitle="words.changes.subsidySubtitle"
          :lines="subsidyLines"
          :empty="words.changes.noSubsidy"
          :add-label="words.changes.addSubsidy"
          :can-add="book.loan.subsidy === null"
          collapse-id="loans.subsidy"
          data-testid="loan-subsidy"
          @add="subsidyOpen = true"
          @change="subsidyOpen = true"
        />
      </DashboardGrid>
      <DashboardGrid layout="pair">
        <ChangeListCard
          :title="words.changes.extraPayments"
          :subtitle="words.changes.extraPaymentsSubtitle"
          :lines="extraLines"
          :empty="words.changes.noExtraPayment"
          :add-label="words.changes.addPayment"
          collapse-id="loans.extra-payments"
          data-testid="extra-payments"
          @add="openExtra(null)"
          @change="changeExtra"
        />
        <ChangeListCard
          :title="words.changes.lateInstalments"
          :subtitle="words.changes.lateInstalmentsSubtitle"
          :lines="lateLines"
          :empty="words.changes.noLateInstalment"
          :add-label="words.changes.markLate"
          collapse-id="loans.late-instalments"
          data-testid="late-instalments"
          @add="openLate(null)"
          @change="openLate"
        />
      </DashboardGrid>
      <BankLoanDialog v-model:open="editingLoan" :book="book" />
      <RatePeriodDialog v-model:open="rateOpen" :book="book" :editing="editingRate" />
      <SubsidyDialog v-model:open="subsidyOpen" :book="book" />
      <ExtraPaymentDialog v-model:open="extraOpen" :book="book" :start="extraStart" />
      <LateInstalmentDialog v-model:open="lateOpen" :book="book" :editing="editingLate" :today="day" />
    </template>
    <ScreenSkeleton v-else-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.bankLoan" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="loan-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
