<script setup lang="ts">
import { computed } from 'vue'

import { paymentsByYear, splitOfRows } from '../domain/loanFigures'
import type { PlanRow } from '../domain/loanPlan'
import { paymentsChart } from './paymentsChart'
import PaymentSplitFigures from './PaymentSplitFigures.vue'
import { subsidyColourOf } from './subsidyColour'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/** Where a bank loan's payments go, year by year and over the whole loan: principal, interest and what the subsidy pays of them. */
const props = defineProps<{
  plan: readonly PlanRow[]
  currentYear: number
  /** The first year with an instalment worked out at a variable rate, null when there is none. */
  estimateFromYear: number | null
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
}>()

const phone = usePhoneLayout()
const chart = computed(() => paymentsChart(paymentsByYear(props.plan), props.currentYear, props.payer, chartTokens(), phone.value, props.estimateFromYear))
const wholeLoan = computed(() => splitOfRows(props.plan))

const legend = computed((): LegendEntry[] => [
  { label: words.split.principal, colour: 'var(--loan-principal)' },
  { label: words.split.interest, colour: 'var(--loan-interest)' },
  ...(chart.value.hasSubsidy ? [{ label: words.subsidyPays(props.payer), colour: subsidyColourOf(wholeLoan.value), mark: 'hatched' as const }] : []),
  ...(chart.value.hasExtra ? [{ label: words.payments.extra, colour: 'var(--loan-principal)', mark: 'outline' as const }] : []),
  ...(chart.value.hasAhead ? [{ label: words.payments.ahead, colour: 'var(--loan-ahead)', mark: 'line' as const }] : []),
])
</script>

<template>
  <ChartCard
    :title="words.payments.title"
    :subtitle="chart.hasSubsidy ? words.payments.subsidySubtitle(payer) : words.payments.subtitle"
    :option="chart.option"
    :description="chart.description"
    :height="280"
    :phone-height="240"
    data-testid="loan-payments-chart"
  >
    <template #legend>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-3 rounded-control bg-elevated p-3 sm:p-4" data-testid="loan-whole-loan">
          <p class="type-label">{{ words.payments.wholeLoan }}</p>
          <PaymentSplitFigures :split="wholeLoan" :payer="payer" />
        </div>
        <ChartLegend :entries="legend" />
      </div>
    </template>
  </ChartCard>
</template>
