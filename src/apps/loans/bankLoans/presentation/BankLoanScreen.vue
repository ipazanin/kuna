<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { subsidyLastCovered } from '../domain/loanFigures'
import { rateText } from '../domain/yearlyRate'
import { balanceChart } from '../../balances/presentation/balanceChart'
import { bankLoanNamed, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import BankLoanDialog from './BankLoanDialog.vue'
import BankLoanTiles from './BankLoanTiles.vue'
import { bankLoanFigures, bankLoanMonths, planYears } from './bankLoanView'
import ChangeListCard from './ChangeListCard.vue'
import type { ChangeLine } from './ChangeListCard.vue'
import ExtraPaymentDialog, { EFFECT_ITEMS } from './ExtraPaymentDialog.vue'
import type { ExtraPaymentStart } from './ExtraPaymentDialog.vue'
import LateInstalmentDialog from './LateInstalmentDialog.vue'
import PlanCard from './PlanCard.vue'
import RatePeriodDialog from './RatePeriodDialog.vue'
import SubsidyDialog from './SubsidyDialog.vue'
import WhatIfPanel from './WhatIfPanel.vue'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { daysBetween, today, yearOf } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'

/** One bank loan: its figures, its balance over time, what an extra payment would do, its plan, and what changes it. */
const { state } = useLoansBooks()
const route = useRoute()
const day = today()

const book = computed(() => (state.workbook === null ? null : bankLoanNamed(state.workbook, route.query.loan)))
const figures = computed(() => (book.value === null ? null : bankLoanFigures(book.value, day)))
const chart = computed(() => (book.value === null ? null : balanceChart(bankLoanMonths(book.value), monthOf(day), chartTokens())))
const years = computed(() => (book.value === null ? [] : planYears(book.value, day)))
/** The current year, or the plan's nearest year to it before the loan starts or after it ends. */
const openYear = computed(() => {
  const current = yearOf(day)
  const [first] = years.value
  const last = years.value.at(-1)
  if (first === undefined || last === undefined || years.value.some((year) => year.year === current)) return current
  return current < first.year ? first.year : last.year
})

const effectName = (effect: string): string => EFFECT_ITEMS.find((item) => item.value === effect)?.label ?? effect

const rateLines = computed((): ChangeLine[] =>
  (book.value?.ratePeriods ?? []).map((period) => ({
    key: period.id,
    title: `${rateText(period.rate)}%, ${period.rateType}`,
    detail: [`From ${dayLabel(period.from)}`, period.note].filter((part) => part !== '').join('. '),
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
      title: `${formatMoney(subsidy.monthly)} a month`,
      detail: `Instalments ${subsidy.firstInstalment} to ${subsidy.firstInstalment + subsidy.instalments - 1}, the last due ${dayLabel(lastCovered)}`,
    },
  ]
})
const extraLines = computed((): ChangeLine[] =>
  [...(book.value?.extraPayments ?? [])]
    .sort((earlier, later) => earlier.date.localeCompare(later.date))
    .map((payment) => ({ key: payment.id, title: formatMoney(payment.amount), detail: `${dayLabel(payment.date)}, ${effectName(payment.effect).toLowerCase()}` })),
)
const lateLines = computed((): ChangeLine[] =>
  [...(book.value?.lateInstalments ?? [])]
    .sort((earlier, later) => earlier.due.localeCompare(later.due))
    .map((late) => ({ key: late.id, title: `Due ${dayLabel(late.due)}`, detail: `Paid ${dayLabel(late.paid)}, ${daysBetween(late.due, late.paid)} days late` })),
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
  <section class="flex max-w-measure flex-col gap-6">
    <UButton :to="LOANS_OVERVIEW_ROUTE" label="All loans" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-loans" />
    <template v-if="book !== null">
      <PageHeader :title="book.loan.name" :description="[book.loan.lender, `${formatMoney(book.loan.principal)} over ${book.loan.instalments} instalments`].filter((part) => part !== '').join(', ')">
        <template #actions>
          <UButton label="Change loan" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="bank-loan-edit" @click="editingLoan = true" />
        </template>
      </PageHeader>
      <UAlert
        v-if="figures === null"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="Kuna cannot work out this loan's plan"
        :description="`No rate period starts at its first instalment on ${dayLabel(book.loan.firstInstalment)}. Add one under Rate periods.`"
      />
      <template v-else>
        <BankLoanTiles :figures="figures" />
        <ChartCard
          v-if="chart !== null"
          title="Owed over time"
          subtitle="At each month end, as the plan gives it. The dashed part is still to come."
          :option="chart.option"
          :description="chart.description"
          :height="280"
          :phone-height="220"
          data-testid="loan-balance-chart"
        />
        <WhatIfPanel :book="book" :default-date="figures.next?.date ?? day" @apply="openExtra" />
        <PlanCard :years="years" :open-year="openYear" :has-subsidy="book.loan.subsidy !== null" />
      </template>
      <div class="wide-pair">
        <ChangeListCard
          title="Rate periods"
          subtitle="The rate from each due date on. A new rate works the instalment out again."
          :lines="rateLines"
          empty="No rate period yet."
          add-label="Add rate"
          collapse-id="loans.rate-periods"
          data-testid="rate-periods"
          @add="openRate(null)"
          @change="openRate"
        />
        <ChangeListCard
          title="Subsidy"
          subtitle="What a third party pays of each instalment it covers."
          :lines="subsidyLines"
          empty="No subsidy on this loan."
          add-label="Add subsidy"
          :can-add="book.loan.subsidy === null"
          collapse-id="loans.subsidy"
          data-testid="loan-subsidy"
          @add="subsidyOpen = true"
          @change="subsidyOpen = true"
        />
      </div>
      <div class="wide-pair">
        <ChangeListCard
          title="Extra payments"
          subtitle="Principal paid back early, for a shorter term or a lower instalment."
          :lines="extraLines"
          empty="No extra payments yet."
          add-label="Add payment"
          collapse-id="loans.extra-payments"
          data-testid="extra-payments"
          @add="openExtra(null)"
          @change="changeExtra"
        />
        <ChangeListCard
          title="Late instalments"
          subtitle="Every instalment counts as paid on its due date, unless it is here."
          :lines="lateLines"
          empty="Every instalment went out on time."
          add-label="Mark late"
          collapse-id="loans.late-instalments"
          data-testid="late-instalments"
          @add="openLate(null)"
          @change="openLate"
        />
      </div>
      <BankLoanDialog v-model:open="editingLoan" :book="book" />
      <RatePeriodDialog v-model:open="rateOpen" :book="book" :editing="editingRate" />
      <SubsidyDialog v-model:open="subsidyOpen" :book="book" />
      <ExtraPaymentDialog v-model:open="extraOpen" :book="book" :start="extraStart" />
      <LateInstalmentDialog v-model:open="lateOpen" :book="book" :editing="editingLate" :today="day" />
    </template>
    <template v-else-if="state.workbook !== null">
      <PageHeader title="Bank loan" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="loan-missing">The Loans file holds no bank loan by this link. It may have been deleted.</p>
      </AppCard>
    </template>
  </section>
</template>
