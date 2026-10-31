<script setup lang="ts">
import { computed, ref } from 'vue'

import { shownValueOverTime, valuePeriods } from '../domain/valueOverTime'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PerformancePeriod } from '../../performance/domain/performancePeriod'
import { valueChart } from './valueChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { listInWords } from '../../../../shared/text/listInWords'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'

/** The value at each month end against what was put in less what was taken out, over the period picked. */
const props = defineProps<{
  sources: PortfolioSources
}>()

type PeriodKey = 1 | 3 | 5 | 'all'

const phone = usePhoneLayout()
const picked = ref<PeriodKey>('all')

const periods = computed(() => valuePeriods(props.sources.book, props.sources.today).map((period): { key: PeriodKey; period: PerformancePeriod } => ({ key: keyOf(period), period })))
const shown = computed(() => shownValueOverTime(props.sources, (periods.value.find((entry) => entry.key === picked.value) ?? periods.value.at(-1)!).period))
const shownKey = computed(() => keyOf(shown.value.period))
const periodChoices = computed(() => periods.value.map((entry) => ({ value: entry.key, label: words.value.period[entry.key] })))
const over = computed(() => shown.value.over)
const chart = computed(() => valueChart(over.value, chartTokens(), phone.value))
const emptyDescription = computed(() => {
  const names = listInWords(over.value.heldBack.instruments.map((instrument) => instrument.name))
  return names === '' ? words.value.emptyDescription : words.value.emptyHeldBack(names)
})

function keyOf(period: PerformancePeriod): PeriodKey {
  return period.kind === 'years' ? period.years : 'all'
}
</script>

<template>
  <ChartCard
    :title="words.value.title"
    :subtitle="words.value.subtitle"
    :option="chart.option"
    :description="chart.description"
    :empty="over.points.length === 0"
    :empty-title="words.value.emptyTitle"
    :empty-description="emptyDescription"
    :height="300"
    :phone-height="220"
    data-testid="investments-value-chart"
  >
    <template #legend>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ChartLegend
          :entries="[
            { label: words.value.value, colour: 'var(--invest-portfolio)', mark: 'line' },
            { label: words.value.putIn, colour: 'var(--invest-reference)', mark: 'dashed' },
          ]"
        />
        <ChoiceButtons
          v-if="periods.length > 1"
          :model-value="shownKey"
          :options="periodChoices"
          :label="words.value.periods"
          data-testid="investments-value-periods"
          @update:model-value="picked = $event"
        />
      </div>
    </template>
  </ChartCard>
</template>
