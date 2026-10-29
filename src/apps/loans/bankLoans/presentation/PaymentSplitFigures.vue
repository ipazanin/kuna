<script setup lang="ts">
import { computed } from 'vue'

import { interestOf, principalOf, subsidyShareOf, yourPrincipalOf, yourShareOf } from '../domain/loanFigures'
import type { PaymentSplit } from '../domain/loanFigures'
import { subsidyColourOf } from './subsidyColour'
import { words } from './words'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import ProgressMeter from '../../../../shared/ui/ProgressMeter.vue'

/** Payments split into principal and interest, the subsidy's part striped across them, with the figures under the bar. */
const props = defineProps<{
  split: PaymentSplit
  /** Who pays the subsidy, empty when the loan does not say. */
  payer: string
}>()

const subsidy = computed(() => subsidyShareOf(props.split))

const facts = computed((): Fact[] => [
  { label: words.split.principal, value: formatMoney(principalOf(props.split)), swatch: { colour: 'var(--loan-principal)' } },
  { label: words.split.interest, value: formatMoney(interestOf(props.split)), swatch: { colour: 'var(--loan-interest)' } },
  ...(subsidy.value > 0
    ? [
        { label: words.subsidyPays(props.payer), value: formatMoney(subsidy.value), swatch: { colour: subsidyColourOf(props.split), mark: 'hatched' as const } },
        { label: words.split.youPay, value: formatMoney(yourShareOf(props.split)) },
      ]
    : []),
])
</script>

<template>
  <div class="flex flex-col gap-3">
    <ProgressMeter
      :parts="[
        { value: yourPrincipalOf(split), colour: 'var(--loan-principal)' },
        { value: split.subsidyPrincipal, colour: 'var(--loan-principal)', striped: true },
        { value: split.subsidyInterest, colour: 'var(--loan-interest)', striped: true },
        { value: split.interest, colour: 'var(--loan-interest)' },
      ]"
      :label="words.split.meter(formatMoney(principalOf(split)), formatMoney(interestOf(split)), payer, subsidy > 0 ? formatMoney(subsidy) : '')"
      :height="10"
    />
    <FactGrid :facts="facts" />
  </div>
</template>
