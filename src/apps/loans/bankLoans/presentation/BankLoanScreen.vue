<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { statementPayments } from '../application/statementPayments'
import { instalmentStandings } from '../domain/instalmentPayments'
import { subsidyLastCovered } from '../domain/loanFigures'
import { fractionOf } from '../domain/yearlyRate'
import { balanceChart } from '../../balances/presentation/balanceChart'
import { DIRECTION_LOOKS } from '../../directions/presentation/loanDirection'
import { bankLoanNamed, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { removeScenario } from '../../scenarios/application/scenarioWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { LATE_INSTALMENT_WRITES } from '../application/bankLoanWrites'
import BalanceHero from './BalanceHero.vue'
import BankLoanDialog from './BankLoanDialog.vue'
import BankLoanTiles from './BankLoanTiles.vue'
import { bankLoanFigures, bankLoanMonths } from '../domain/bankLoanFigures'
import { bankLoanMoves, planYearsOnScreen } from './bankLoanView'
import ChangeListCard from './ChangeListCard.vue'
import type { ChangeLine } from './ChangeListCard.vue'
import ExtraPaymentDialog from './ExtraPaymentDialog.vue'
import type { ExtraPaymentStart } from './ExtraPaymentDialog.vue'
import LateInstalmentDialog from './LateInstalmentDialog.vue'
import PaymentsCard from './PaymentsCard.vue'
import PlanCard from './PlanCard.vue'
import RatePeriodDialog from './RatePeriodDialog.vue'
import { savedTries } from './savedTries'
import SubsidyDialog from './SubsidyDialog.vue'
import WhatIfPanel from './WhatIfPanel.vue'
import type { InstalmentStanding } from '../domain/instalmentPayments'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { daysBetween, today, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { words as loansWords } from '../../words'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import { provideLoanWords } from './useLoanWords'

/** One bank loan: what is owed and paid back, its balance over time, where its payments go, what a change would do and the tries saved, its plan, and what changes it. */
const store = useLoansBooks()
const { state } = store
const writes = useRecordWrites(store)
const route = useRoute()
const day = today()

const book = computed(() => (state.workbook === null ? null : bankLoanNamed(state.workbook, route.query.loan)))
const loanWords = provideLoanWords(() => book.value?.loan.repayment ?? 'annuity')
const figures = computed(() => (book.value === null ? null : bankLoanFigures(book.value, day)))
const payments = computed(() => statementPayments())
const standings = computed(() => (book.value === null ? new Map<CivilDate, InstalmentStanding>() : instalmentStandings(book.value, payments.value, day)))
const years = computed(() => (book.value === null ? [] : planYearsOnScreen(book.value, day, standings.value)))
const payer = computed(() => book.value?.loan.subsidy?.payer ?? '')
const phone = usePhoneLayout()
const estimateFrom = computed(() => years.value.flatMap((year) => year.lines).find((line) => line.estimate)?.date ?? null)
const months = computed(() => (book.value === null ? [] : bankLoanMonths(book.value)))
const loanRange = useChartRange(
  () => {
    const [first] = months.value
    const last = months.value.at(-1)
    return first === undefined || last === undefined ? null : wholeMonthsSpan(first.month, last.month)
  },
  () => day,
)
const chart = computed(() => {
  if (book.value === null) return null
  return balanceChart(
    months.value.filter((entry) => monthInRange(loanRange.window.value, entry.month)),
    monthOf(day),
    chartTokens(),
    phone.value,
    {
      token: DIRECTION_LOOKS['you-owe'].token,
      moves: bankLoanMoves(book.value, day, standings.value),
      estimateFrom: estimateFrom.value === null ? null : monthOf(estimateFrom.value),
    },
  )
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
    title: loanWords.value.changes.rate(formatRate(fractionOf(period.rate)), loanWords.value.changes.rateTypes[period.rateType]),
    detail: loanWords.value.changes.rateDetail(dayLabel(period.from), period.note),
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
      title: loanWords.value.changes.subsidyMonthly(formatMoney(subsidy.monthly)),
      detail: loanWords.value.changes.subsidyDetail(loanWords.value.subsidyPays(subsidy.payer), subsidy.firstInstalment, subsidy.firstInstalment + subsidy.instalments - 1, dayLabel(lastCovered)),
    },
  ]
})
const extraLines = computed((): ChangeLine[] =>
  [...(book.value?.extraPayments ?? [])]
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
    .map((payment) => ({ key: payment.id, title: formatMoney(payment.amount), detail: loanWords.value.changes.extraDetail(dayLabel(payment.date), payment.effect) })),
)
/** Each late instalment, and Delete in place of Change on one whose linked statement row went out on another day, since the plan goes by the row. */
const lateLines = computed((): ChangeLine[] =>
  [...(book.value?.lateInstalments ?? [])]
    .sort((earlier, later) => earlier.due.localeCompare(later.due))
    .map((late) => {
      const days = daysBetween(late.due, late.paid)
      const line = { key: late.id, title: loanWords.value.changes.due(dayLabel(late.due)), detail: plural(loanWords.value.status.paidLate(days, dayLabel(late.paid)), days) }
      const standing = standings.value.get(late.due)
      if (standing?.standing !== 'seen' || standing.overruled === null) return line
      return { ...line, detail: loanWords.value.changes.statementDay(line.detail, dayLabel(standing.paid)), removable: true }
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

const tries = computed(() => (book.value === null || state.workbook === null ? [] : savedTries(book.value, state.workbook.scenarios, day)))
const triedLines = computed((): ChangeLine[] => tries.value.map((tried) => ({ ...tried, removable: true })))

async function removeTry(key: string): Promise<void> {
  const records = state.records
  const tried = tries.value.find((entry) => entry.key === key) ?? null
  if (records !== null && tried !== null) {
    await writes.write(loanWords.value.savedTries.deleted, (unit) => removeScenario(unit, records, tried.kept.scenario), {
      description: loanWords.value.savedTries.named(tried.title),
      failedTitle: loansWords.form.notDeleted,
      key: `delete-${key}`,
    })
  }
}

async function removeLate(key: string): Promise<void> {
  const late = book.value?.lateInstalments.find((entry) => entry.id === key)
  if (late !== undefined) {
    await writes.write(loanWords.value.lateDialog.deleted, (unit) => unit.of(LATE_INSTALMENT_WRITES).remove(late), { failedTitle: loansWords.form.notDeleted, key: `delete-${key}` })
  }
}

function openLate(key: string | null): void {
  editingLate.value = book.value?.lateInstalments.find((late) => late.id === key) ?? null
  lateOpen.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <UButton :to="LOANS_OVERVIEW_ROUTE" :label="loanWords.allLoans" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-loans" />
    <template v-if="book !== null">
      <PageHeader
        :title="book.loan.name"
        :description="[book.loan.lender, plural(loanWords.terms(book.loan.instalments, formatMoney(book.loan.principal)), book.loan.instalments)].filter((part) => part !== '').join(', ')"
      >
        <template #actions>
          <UButton :label="loanWords.changeLoan" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="bank-loan-edit" @click="editingLoan = true" />
        </template>
      </PageHeader>
      <UAlert
        v-if="figures === null"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="loanWords.noPlanTitle"
        :description="loanWords.noPlan(dayLabel(book.loan.firstInstalment))"
      />
      <template v-else>
        <BalanceHero :loan="book.loan" :figures="figures" />
        <BankLoanTiles :figures="figures" :payer="payer" />
        <DashboardGrid layout="pair">
          <ChartCard
            v-if="chart !== null"
            v-model:range="loanRange.range.value"
            :title="loanWords.balance.title"
            :subtitle="loanWords.balance.subtitle(chart.drawsPlan)"
            :option="chart.option"
            :description="chart.description"
            :height="280"
            :phone-height="220"
            :ranges="loanRange.ranges.value"
            data-testid="loan-balance-chart"
          >
            <template #legend>
              <ChartLegend :entries="chart.legend" />
            </template>
          </ChartCard>
          <PaymentsCard
            v-if="book.plan !== null"
            v-model:range="loanRange.range.value"
            :plan="book.plan"
            :current-year="yearOf(day)"
            :estimate-from-year="estimateFrom === null ? null : yearOf(estimateFrom)"
            :payer="payer"
            :ranges="loanRange.ranges.value"
            :shown-days="loanRange.window.value"
          />
        </DashboardGrid>
        <DashboardGrid layout="pair">
          <WhatIfPanel :book="book" :default-date="figures.next?.date ?? day" :today="day" @apply="openExtra" />
          <ChangeListCard
            :title="loanWords.savedTries.title"
            :subtitle="loanWords.savedTries.subtitle"
            :lines="triedLines"
            :empty="loanWords.savedTries.empty"
            :can-add="false"
            :removing="tries.find((entry) => writes.saving(`delete-${entry.key}`))?.key ?? null"
            collapse-id="loans.saved-tries"
            data-testid="saved-tries"
            @remove="removeTry"
          />
        </DashboardGrid>
        <PlanCard :years="years" :open-year="openYear" :has-subsidy="book.loan.subsidy !== null" :unchecked="payments === 'unchecked'" />
      </template>
      <DashboardGrid layout="pair">
        <ChangeListCard
          :title="loanWords.changes.ratePeriods"
          :subtitle="loanWords.changes.ratePeriodsSubtitle"
          :lines="rateLines"
          :empty="loanWords.changes.noRatePeriod"
          :add-label="loanWords.changes.addRate"
          collapse-id="loans.rate-periods"
          data-testid="rate-periods"
          @add="openRate(null)"
          @change="openRate"
        />
        <ChangeListCard
          :title="loanWords.changes.subsidy"
          :subtitle="loanWords.changes.subsidySubtitle"
          :lines="subsidyLines"
          :empty="loanWords.changes.noSubsidy"
          :add-label="loanWords.changes.addSubsidy"
          :can-add="book.loan.subsidy === null"
          collapse-id="loans.subsidy"
          data-testid="loan-subsidy"
          @add="subsidyOpen = true"
          @change="subsidyOpen = true"
        />
      </DashboardGrid>
      <DashboardGrid layout="pair">
        <ChangeListCard
          :title="loanWords.changes.extraPayments"
          :subtitle="loanWords.changes.extraPaymentsSubtitle"
          :lines="extraLines"
          :empty="loanWords.changes.noExtraPayment"
          :add-label="loanWords.changes.addPayment"
          collapse-id="loans.extra-payments"
          data-testid="extra-payments"
          @add="openExtra(null)"
          @change="changeExtra"
        />
        <ChangeListCard
          :title="loanWords.changes.lateInstalments"
          :subtitle="loanWords.changes.lateInstalmentsSubtitle"
          :lines="lateLines"
          :empty="loanWords.changes.noLateInstalment"
          :add-label="loanWords.changes.markLate"
          :removing="lateLines.find((line) => writes.saving(`delete-${line.key}`))?.key ?? null"
          collapse-id="loans.late-instalments"
          data-testid="late-instalments"
          @add="openLate(null)"
          @change="openLate"
          @remove="removeLate"
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
      <PageHeader :title="loanWords.bankLoan" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="loan-missing">{{ loanWords.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
