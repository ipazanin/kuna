<script setup lang="ts">
import { computed } from 'vue'

import { incomeAgainstLastYear } from '../domain/overviewFigures'
import { valueOverTime } from '../domain/valueOverTime'
import type { PortfolioSources } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { PERFORMANCE_ROUTE } from '../../performance/presentation/performanceLinks'
import { HOLDINGS_ROUTE } from '../../holdings/presentation/holdingLinks'
import { todayLine } from '../../holdings/presentation/holdingText'
import { words as holdingWords } from '../../holdings/presentation/words'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { rangeWindow } from '../../../../shared/charts/chartRange'
import { formatMoney, formatPercent, formatPercentChange } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import type { KpiDelta } from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The figures that lead the Overview: the day's change, which opens each holding's change on Holdings, the value, the total gain, the yearly return and this year's income, which opens the income on Performance. */
const props = defineProps<{
  sources: PortfolioSources
  figures: PortfolioFigures
}>()

const unpriced = computed(() => props.figures.unpriced.length)

/** The month ends of the last year as a sparkline, once there are two. */
const valueTrend = computed((): { trend?: readonly number[] } => {
  const trend = valueOverTime(props.sources, rangeWindow('1y', props.sources.today)).points.flatMap((point) => (point.value === null ? [] : [point.value]))
  return trend.length >= 2 ? { trend } : {}
})

/** The day's change in euros, with its share as the delta against the close before. */
const day = computed(() => {
  const change = props.figures.lastDay
  if (change === null) {
    return null
  }
  const delta: KpiDelta | undefined = change.share === null ? undefined : { change: change.change, text: formatPercentChange(change.share), comparison: words.tiles.since(shortDayLabel(change.from)) }
  const quoted = change.quoted
  const caption =
    quoted === undefined
      ? words.tiles.closeOf(shortDayLabel(change.to))
      : quoted.atLastClose > 0
        ? plural(holdingWords.today.atLastClose(quoted.atLastClose, shortDayLabel(change.from)), quoted.atLastClose)
        : (todayLine(change) ?? '')
  return { change, label: quoted === undefined ? words.tiles.lastDay : words.tiles.today, caption, ...(delta === undefined ? {} : { delta }) }
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
      v-if="day !== null"
      :label="day.label"
      :value="formatMoney(day.change.change, 'always')"
      :caption="day.caption"
      v-bind="day.delta === undefined ? {} : { delta: day.delta }"
      :definition="words.tiles.lastDayDefinition"
      :to="HOLDINGS_ROUTE"
      data-testid="investments-day"
    >
      <template #value><MoneyText :cents="day.change.change" tone="outcome" /></template>
    </KpiTile>
    <KpiTile
      :label="unpriced > 0 ? words.tiles.knownValue : words.tiles.value"
      :value="formatMoney(figures.value)"
      v-bind="valueTrend"
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
      <template #value><MoneyText :cents="figures.totalGain" tone="outcome" /></template>
    </KpiTile>
    <KpiTile :label="words.tiles.yearlyReturn" :value="yearly.value" :caption="yearly.caption" :definition="words.tiles.yearlyReturnDefinition" :to="null" data-testid="investments-yearly-return" />
    <KpiTile
      :label="words.tiles.incomeIn(income.year)"
      :value="formatMoney(income.thisYear)"
      :delta="incomeDelta"
      :definition="words.tiles.incomeDefinition"
      :to="{ path: PERFORMANCE_ROUTE, query: { tab: 'income' } }"
      data-testid="investments-income"
    />
  </DashboardGrid>
</template>
