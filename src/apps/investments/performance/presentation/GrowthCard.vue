<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { growthChart } from './growthChart'
import { words } from './words'
import { comparedLegend } from '../../compare/presentation/comparedSeries'
import CompareWith from '../../compare/presentation/CompareWith.vue'
import { useComparison } from '../../compare/presentation/useComparison'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { dayOfCategory } from '../../../../shared/charts/dayAxis'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney, formatPercentChange } from '../../../../shared/money/moneyFormat'
import { withFullStop } from '../../../../shared/text/withFullStop'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../../shared/ui/ChartLegend.vue'

/**
 * €100 on the period's first day grown at the portfolio's time-weighted return, beside the benchmark's own price on one
 * axis, or with a ticker compared, both as change since the first day. Under it, what the same deposits and withdrawals
 * would be worth in the benchmark, with both rates a year.
 */
const props = defineProps<{
  performance: PeriodPerformance
  /** The benchmark's name while the figures compare with it. */
  benchmarkName: string | null
}>()

const phone = usePhoneLayout()
const comparison = useComparison(() => props.performance.growth.map((point) => point.date), 'in-euros')
const benchmark = computed(() => (props.performance.benchmark === null ? null : props.benchmarkName))
const chart = computed(() => growthChart(props.performance.growth, benchmark.value, chartTokens(), phone.value, comparison.line.value))
const legend = computed((): LegendEntry[] => {
  const compared = comparison.line.value
  return [
    { label: words.growth.portfolio, colour: 'var(--invest-portfolio)', mark: 'line' },
    ...(compared !== null ? [comparedLegend(compared)] : benchmark.value === null ? [] : [{ label: benchmark.value, colour: 'var(--invest-reference)', mark: 'dashed' as const }]),
  ]
})

/** As "The same money in Example Index Fund, put in and taken out on the same days, would be worth €3,540.00 against your €3,414.75. You are €125.25 behind, at +7.37% a year against +9.51%." */
const replay = computed(() => {
  const shown = props.performance.benchmark
  if (shown === null || props.benchmarkName === null) return null
  const text = words.replay
  const portfolio = props.performance.portfolio
  const amount = formatMoney(shown.valueDifference, 'magnitude')
  const gap = shown.valueDifference > 0 ? text.ahead(amount) : shown.valueDifference < 0 ? text.behind(amount) : text.level
  const rates =
    shown.replay.moneyWeighted.kind === 'rate' && portfolio.moneyWeighted.kind === 'rate'
      ? [text.rates(formatPercentChange(portfolio.moneyWeighted.rate), formatPercentChange(shown.replay.moneyWeighted.rate))]
      : []
  return {
    line: `${text.lead(props.benchmarkName, formatMoney(shown.replay.value), formatMoney(portfolio.value))} ${withFullStop([gap, ...rates].join(', '))}`,
    unpaid: shown.replay.unpaid.map((flow) => text.unpaid(dayLabel(flow.date), formatMoney(flow.amount))),
  }
})
</script>

<template>
  <ChartCard
    :title="chart.title"
    :subtitle="chart.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="performance.growth.length < 2"
    :empty-title="performance.belowZeroOn === null ? words.growth.emptyTitle : words.growth.belowZeroTitle"
    :empty-description="performance.belowZeroOn === null ? words.growth.emptyDescription : words.growth.belowZeroDescription"
    :category-label="dayOfCategory"
    :format-value="chart.formatValue"
    :height="300"
    :phone-height="220"
    data-testid="performance-growth"
  >
    <template #legend>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ChartLegend :entries="legend" />
        <CompareWith
          :name="comparison.name.value"
          :fetching="comparison.fetching.value"
          :note="comparison.note.value"
          :reading="comparison.reading"
          @pick="comparison.pick"
          @remove="comparison.remove"
        />
      </div>
    </template>
    <template v-if="replay !== null" #footer>
      <div class="flex flex-col gap-2 border-t border-default px-4 py-3 sm:px-5" data-testid="performance-replay">
        <p class="type-body text-highlighted" data-testid="performance-replay-line">{{ replay.line }}</p>
        <ul v-if="replay.unpaid.length > 0" class="flex flex-col gap-1 type-caption" data-testid="performance-replay-unpaid">
          <li v-for="line in replay.unpaid" :key="line">{{ line }}</li>
        </ul>
      </div>
    </template>
  </ChartCard>
</template>
