<script setup lang="ts">
import { computed } from 'vue'

import { paymentsByYear, splitOfRows } from '../domain/loanFigures'
import type { PlanRow } from '../domain/loanPlan'
import { paymentsChart } from './paymentsChart'
import PaymentSplitFigures from './PaymentSplitFigures.vue'
import { subsidyColourOf } from './subsidyColour'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { yearInRange } from '../../../../shared/charts/chartRange'
import type { ChartRange } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'
import { useLoanWords } from './useLoanWords'

/** Where a bank loan's payments go, year by year and over the whole loan: principal, interest and what the subsidy pays of them. */
const props = defineProps<{
  plan: readonly PlanRow[]
  currentYear: number
  /** The first year with an instalment worked out at a variable rate, null when there is none. */
  estimateFromYear: number | null
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
  /** The ranges the screen's Owed over time offers, so both charts pick from one list and show one span. */
  ranges: readonly ChartRange[]
  /** The days the picked range keeps, null for All. A year counts whole once any of its days is kept. */
  shownDays: DateRange | null
}>()
const loanWords = useLoanWords()

const range = defineModel<ChartRange>('range', { required: true })

const phone = usePhoneLayout()
const chart = computed(() =>
  paymentsChart(
    paymentsByYear(props.plan).filter((entry) => yearInRange(props.shownDays, entry.year)),
    props.currentYear,
    props.payer,
    chartTokens(),
    phone.value,
    props.estimateFromYear,
    loanWords.value,
  ),
)
const wholeLoan = computed(() => splitOfRows(props.plan))

const legend = computed((): LegendEntry[] => [
  { label: loanWords.value.split.principal, colour: 'var(--loan-principal)' },
  { label: loanWords.value.split.interest, colour: 'var(--loan-interest)' },
  ...(chart.value.hasSubsidy ? [{ label: loanWords.value.subsidyPays(props.payer), colour: subsidyColourOf(wholeLoan.value), mark: 'hatched' as const }] : []),
  ...(chart.value.hasExtra ? [{ label: loanWords.value.payments.extra, colour: 'var(--loan-principal)', mark: 'outline' as const }] : []),
  ...(chart.value.hasAhead ? [{ label: loanWords.value.payments.ahead, colour: 'var(--loan-ahead)', mark: 'line' as const }] : []),
])
</script>

<template>
  <ChartCard
    v-model:range="range"
    :title="loanWords.payments.title"
    :subtitle="chart.hasSubsidy ? loanWords.payments.subsidySubtitle(payer) : loanWords.payments.subtitle"
    :option="chart.option"
    :description="chart.description"
    :height="280"
    :phone-height="240"
    :ranges="ranges"
    data-testid="loan-payments-chart"
  >
    <template #legend>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 rounded-control bg-elevated p-3 sm:p-4" data-testid="loan-whole-loan">
          <p class="type-label">{{ loanWords.payments.wholeLoan }}</p>
          <PaymentSplitFigures :split="wholeLoan" :payer="payer" />
        </div>
        <ChartLegend :entries="legend" />
      </div>
    </template>
  </ChartCard>
</template>
