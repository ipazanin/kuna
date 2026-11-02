<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodPerformance } from '../domain/portfolioPerformance'
import { underwater } from '../domain/underwater'
import { underwaterChart } from './underwaterChart'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { dayOfCategory } from '../../../../shared/charts/dayAxis'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatPercentChange } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** The period's growth line as its fall below the running peak, with the fall now, the deepest and the longest time below a peak. */
const props = defineProps<{
  performance: PeriodPerformance
}>()

const text = words.falls
const phone = usePhoneLayout()
const below = computed(() => underwater(props.performance.growth))
const chart = computed(() => (below.value === null ? null : underwaterChart(below.value, chartTokens(), phone.value)))

const facts = computed((): Fact[] => {
  const shown = below.value
  if (shown === null) {
    return []
  }
  const longest = shown.longest
  return [
    { label: text.now, value: formatPercentChange(shown.now), ...(shown.now === 0 ? { caption: text.atPeak } : {}) },
    { label: text.deepest, value: formatPercentChange(shown.deepest) },
    longest === null
      ? { label: text.longest, value: '–', caption: text.neverFell }
      : {
          label: text.longest,
          value: plural(text.days(longest.days), longest.days),
          caption: longest.regained ? text.regained(dayLabel(longest.from), dayLabel(longest.to)) : text.notRegained(dayLabel(longest.from)),
        },
  ]
})
</script>

<template>
  <ChartCard
    :title="text.title"
    :subtitle="text.subtitle"
    :option="chart?.option ?? {}"
    :description="chart?.description ?? text.emptyDescription"
    :empty="chart === null"
    :empty-title="performance.belowZeroOn === null ? text.emptyTitle : words.growth.belowZeroTitle"
    :empty-description="performance.belowZeroOn === null ? text.emptyDescription : words.growth.belowZeroDescription"
    :category-label="dayOfCategory"
    :format-value="formatPercentChange"
    :height="260"
    :phone-height="200"
    data-testid="performance-underwater"
  >
    <template v-if="facts.length > 0" #footer>
      <div class="border-t border-default px-4 py-3 sm:px-5">
        <FactGrid :facts="facts" />
      </div>
    </template>
  </ChartCard>
</template>
