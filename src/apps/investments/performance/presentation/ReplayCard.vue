<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BenchmarkState } from '../domain/benchmark'
import type { BenchmarkComparison, PeriodPerformance } from '../domain/portfolioPerformance'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney, formatPercentChange } from '../../../../shared/money/moneyFormat'
import { withFullStop } from '../../../../shared/text/withFullStop'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** What the portfolio's deposits and withdrawals would be worth in the benchmark, with both rates a year, beside the portfolio's own. */
const props = defineProps<{
  performance: PeriodPerformance
  benchmark: BenchmarkState
}>()

const text = words.replay
const name = computed(() => (props.benchmark.kind === 'none' ? '' : props.benchmark.instrument.name))
const comparison = computed((): BenchmarkComparison | null => props.performance.benchmark)

const gap = computed(() => {
  const shown = comparison.value
  if (shown === null) return ''
  const amount = formatMoney(shown.valueDifference, 'magnitude')
  return shown.valueDifference > 0 ? text.ahead(amount) : shown.valueDifference < 0 ? text.behind(amount) : text.level
})

/** Both rates a year, once both have one. */
const rates = computed(() => {
  const shown = comparison.value
  if (shown === null || shown.replay.moneyWeighted.kind !== 'rate' || props.performance.portfolio.moneyWeighted.kind !== 'rate') return null
  return text.rates(formatPercentChange(shown.replay.moneyWeighted.rate), formatPercentChange(props.performance.portfolio.moneyWeighted.rate))
})

/** Why there is nothing to compare: no benchmark chosen, none of its closes yet, or none for the period's first day. */
const missing = computed(() => {
  switch (props.benchmark.kind) {
    case 'none':
      return { title: text.noneTitle, description: text.noneDescription }
    case 'no-closes':
      return { title: text.noClosesTitle(name.value), description: text.noClosesDescription }
    case 'priced':
      return { title: text.noCloseThenTitle(name.value, dayLabel(props.performance.from)), description: text.noCloseThenDescription }
  }
})

/** As "€3,540.00 against your €3,414.75, €125.25 behind, 9.51% against 7.37% a year". */
const line = computed(() => {
  const shown = comparison.value
  if (shown === null) return ''
  return withFullStop([text.lead(formatMoney(shown.replay.value), formatMoney(props.performance.portfolio.value)), gap.value, ...(rates.value === null ? [] : [rates.value])].join(', '))
})
</script>

<template>
  <AppCard :title="name === '' ? text.anyTitle : text.title(name)" :subtitle="text.subtitle" data-testid="performance-replay">
    <div v-if="comparison !== null" class="flex flex-col gap-4 px-4 pt-1 pb-4 sm:px-5">
      <p class="type-body text-highlighted" data-testid="performance-replay-line">{{ line }}</p>
      <ul v-if="comparison.replay.unpaid.length > 0" class="flex flex-col gap-1 type-caption" data-testid="performance-replay-unpaid">
        <li v-for="flow in comparison.replay.unpaid" :key="flow.date">{{ text.unpaid(dayLabel(flow.date), formatMoney(flow.amount)) }}</li>
      </ul>
    </div>
    <EmptyState v-else class="mx-4 mb-4 sm:mx-5" icon="i-lucide-chart-line" :title="missing.title" :description="missing.description">
      <template v-if="benchmark.kind === 'none'" #actions>
        <UButton :label="text.toSettings" :to="INVESTMENTS_SETTINGS_ROUTE" icon="i-lucide-settings" color="neutral" variant="outline" />
      </template>
    </EmptyState>
  </AppCard>
</template>
