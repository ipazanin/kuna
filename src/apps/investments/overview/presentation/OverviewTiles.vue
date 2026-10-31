<script setup lang="ts">
import { computed } from 'vue'

import { incomeAgainstLastYear } from '../domain/overviewFigures'
import { valueOverTime } from '../domain/valueOverTime'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney, formatPercent, formatPercentChange } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import type { KpiDelta } from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The four figures that lead the Overview: the value, the total gain, the yearly return and this year's income. */
const props = defineProps<{
  sources: PortfolioSources
  figures: PortfolioFigures
}>()

const unpriced = computed(() => props.figures.unpriced.length)

/** The last day's change and the month ends of the last year as a sparkline, each once there is one. */
const valueExtras = computed((): { delta?: KpiDelta; trend?: readonly number[] } => {
  const change = props.figures.lastDay
  const trend = valueOverTime(props.sources, { kind: 'years', years: 1 }).points.flatMap((point) => (point.value === null ? [] : [point.value]))
  return {
    ...(change === null
      ? {}
      : {
          delta: {
            change: change.change,
            text: change.share === null ? formatMoney(change.change, 'always') : words.tiles.change(formatMoney(change.change, 'always'), formatPercentChange(change.share)),
            comparison: words.tiles.lastDay(shortDayLabel(change.to)),
          },
        }),
    ...(trend.length >= 2 ? { trend } : {}),
  }
})

const gainCaption = computed(() => {
  const { totalGainShare, putIn } = props.figures
  return totalGainShare === null ? words.tiles.tookOutMore : words.tiles.onPutIn(formatPercent(totalGainShare, 'always'), formatMoney(putIn))
})

const yearly = computed(() => {
  const yearlyReturn = props.figures.yearlyReturn
  switch (yearlyReturn.kind) {
    case 'rate':
      return { value: formatPercent(yearlyReturn.rate, 'always'), caption: words.tiles.aYear }
    case 'under-a-year':
      return { value: words.tiles.notAYear, caption: words.tiles.notAYearCaption }
    case 'none':
      return { value: words.tiles.noReturn, caption: '' }
  }
})

const income = computed(() => incomeAgainstLastYear(props.sources.book, props.sources.today))
const incomeDelta = computed((): KpiDelta => ({ change: income.value.change, text: formatMoney(income.value.change, 'always'), comparison: words.tiles.againstLastYear(income.value.year - 1) }))
</script>

<template>
  <DashboardGrid layout="tiles" data-testid="investments-tiles">
    <KpiTile
      :label="unpriced > 0 ? words.tiles.knownValue : words.tiles.value"
      :value="formatMoney(figures.value)"
      v-bind="valueExtras"
      :caption="unpriced > 0 ? plural(words.tiles.leavesOut(unpriced), unpriced) : ''"
      :definition="words.tiles.valueDefinition"
      :to="null"
      data-testid="investments-value"
    />
    <KpiTile
      :label="words.tiles.totalGain"
      :value="formatMoney(figures.totalGain, 'always')"
      :caption="gainCaption"
      :definition="words.tiles.totalGainDefinition"
      :to="null"
      data-testid="investments-total-gain"
    >
      <template #value><MoneyText :cents="figures.totalGain" sign="always" tone="outcome" /></template>
    </KpiTile>
    <KpiTile :label="words.tiles.yearlyReturn" :value="yearly.value" :caption="yearly.caption" :definition="words.tiles.yearlyReturnDefinition" :to="null" data-testid="investments-yearly-return" />
    <KpiTile
      :label="words.tiles.incomeIn(income.year)"
      :value="formatMoney(income.thisYear)"
      :delta="incomeDelta"
      :definition="words.tiles.incomeDefinition"
      :to="null"
      data-testid="investments-income"
    />
  </DashboardGrid>
</template>
