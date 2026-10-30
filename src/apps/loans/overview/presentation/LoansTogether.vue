<script setup lang="ts">
import { computed } from 'vue'

import { estimateFrom, outgoingByMonth, owedByMonth, upcomingPayments } from '../domain/loansTogether'
import type { PlannedLoan } from '../domain/loansTogether'
import { loanBandToken, outgoingChart, owedTogetherChart } from './togetherCharts'
import UpcomingPaymentsCard from './UpcomingPaymentsCard.vue'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'

/** Every bank loan together: what they owe over time, what goes out each month, and the payments coming up. */
const props = defineProps<{
  loans: readonly PlannedLoan[]
  day: CivilDate
  /** The day you are free of all debt, null while a loan has no end the plans give. */
  freeOfDebtOn: CivilDate | null
}>()

/** How many payments the card lists before its links to each loan's plan. */
const UPCOMING_SHOWN = 6

const phone = usePhoneLayout()
const current = computed(() => monthOf(props.day))
const estimate = computed(() => estimateFrom(props.loans, props.day))
const owed = computed(() => owedTogetherChart(props.loans, owedByMonth(props.loans), current.value, props.freeOfDebtOn, chartTokens(), phone.value, estimate.value))
const outgoing = computed(() => outgoingChart(props.loans, outgoingByMonth(props.loans), current.value, chartTokens(), phone.value, estimate.value))
const upcoming = computed(() => upcomingPayments(props.loans, props.day).slice(0, UPCOMING_SHOWN))

const bands = computed((): LegendEntry[] => props.loans.map((loan, place) => ({ label: loan.loan.name, colour: `var(${loanBandToken(place)})` })))
</script>

<template>
  <DashboardGrid data-testid="loans-together">
    <ChartCard
      :title="words.together.owedTitle"
      :subtitle="words.together.owedSubtitle"
      :option="owed.option"
      :description="owed.description"
      :height="280"
      :phone-height="220"
      data-testid="loans-owed-chart"
    >
      <template #legend>
        <ChartLegend :entries="[...bands, ...(owed.hasAhead ? [{ label: words.together.stillToCome, colour: 'var(--loan-ahead)', mark: 'dashed' as const }] : [])]" />
      </template>
    </ChartCard>
    <ChartCard
      :title="words.together.outgoingTitle"
      :subtitle="words.together.outgoingSubtitle"
      :option="outgoing.option"
      :description="outgoing.description"
      :height="280"
      :phone-height="220"
      data-testid="loans-outgoing-chart"
    >
      <template #legend>
        <ChartLegend :entries="[...bands, ...(outgoing.hasAhead ? [{ label: words.together.ahead, colour: 'var(--loan-ahead)', mark: 'line' as const }] : [])]" />
      </template>
    </ChartCard>
    <UpcomingPaymentsCard :payments="upcoming" :loans="loans" class="xl:col-span-2 3xl:col-span-1" />
  </DashboardGrid>
</template>
