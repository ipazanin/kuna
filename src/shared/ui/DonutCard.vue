<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface DonutPart {
  /** Stays the same for the same thing on every screen, such as a bucket or a tax. */
  readonly key: string
  readonly label: string
  /** Above zero. A part of zero is listed and leaves no slice. */
  readonly value: number
  /** The colour token of the thing the part stands for, such as `--bucket-taxes`, never one picked by rank. */
  readonly colour: string
  /** Where the part's rows open, or null when none are behind it. */
  readonly to: RouteLocationRaw | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import VChart from 'vue-echarts'

import '../charts/echarts'
import type { ChartOption } from '../charts/echarts'
import { buildChartTheme } from '../charts/chartTheme'
import { chartTokens, tokenColour } from '../charts/chartTokens'
import { usePhoneLayout } from '../layout/viewport'
import { formatWholeMoney } from '../money/moneyFormat'
import AppCard from './AppCard.vue'
import DrillLink from './DrillLink.vue'

/**
 * One snapshot of at most five parts as a ring, with the total in its middle. The list beside it
 * gives each part's value and share and opens its rows, so it is also the table of the chart.
 */
const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    definition?: string
    /** What the ring shows, in words and figures, for a screen reader. */
    description: string
    parts: readonly DonutPart[]
    /** The figure in the middle of the ring, already written out, such as "€84,210". */
    total: string
    /** What the middle figure is, such as "income, last 12 months". */
    totalLabel: string
    formatValue?: (value: number) => string
    /** What a part's link opens, for a screen reader, such as "the statements". */
    opens?: string
    collapseId?: string
    summary?: string
    startCollapsed?: boolean
    reveal?: boolean
  }>(),
  { formatValue: (value: number) => formatWholeMoney(value), opens: 'the rows', startCollapsed: false, reveal: false },
)

const router = useRouter()
const phone = usePhoneLayout()
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const theme = computed(() => buildChartTheme(chartTokens()))

const whole = computed(() => props.parts.reduce((sum, part) => sum + Math.max(part.value, 0), 0))

function share(value: number): string {
  if (whole.value <= 0 || value <= 0) return '0%'
  const percent = (value / whole.value) * 100
  return percent < 0.5 ? '<1%' : `${Math.round(percent)}%`
}

const option = computed<ChartOption>(() => {
  const tokens = chartTokens()
  return {
    aria: { enabled: true, label: { description: props.description } },
    animation: !reducedMotion,
    animationDuration: 450,
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (point: unknown) => {
        const { name, value } = point as { name: string; value: number }
        return `${name}<br><b>${props.formatValue(value)}</b>, ${share(value)}`
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '82%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: tokens.surface, borderWidth: 2 },
        emphasis: { scale: true, scaleSize: 3 },
        data: props.parts
          .filter((part) => part.value > 0)
          .map((part) => ({ name: part.label, value: part.value, itemStyle: { color: tokenColour(part.colour) } })),
      },
    ],
  }
})

/** A click on a slice opens its rows. A phone's tap only shows the tooltip, and the list right below holds the links. */
function onSliceClick(event: { dataIndex?: number; name?: string }): void {
  if (phone.value) return
  const part = props.parts.find((candidate) => candidate.label === event.name)
  if (part?.to) void router.push(part.to)
}
</script>

<template>
  <AppCard
    data-testid="donut-card"
    :title="title"
    :subtitle="subtitle"
    :definition="definition"
    v-bind="collapseId === undefined ? {} : { collapseId, summary, startCollapsed, reveal }"
  >
    <div class="donut px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div class="donut-ring">
        <VChart :option="option" :theme="theme" autoresize class="ring-chart" @click="onSliceClick" />
        <p class="ring-middle" aria-hidden="true">
          <span class="figure text-xl font-semibold text-highlighted">{{ total }}</span>
          <span class="text-xs text-muted">{{ totalLabel }}</span>
        </p>
      </div>
      <div class="legend">
        <p class="sr-only">{{ totalLabel }}: {{ total }}</p>
        <ul class="flex flex-col" data-testid="donut-legend">
          <li v-for="part in parts" :key="part.key" class="legend-row">
            <span class="swatch" :style="{ background: `var(${part.colour})` }" aria-hidden="true" />
            <DrillLink :to="part.to" :label="`${part.label}, ${formatValue(part.value)}, open ${opens}`" class="min-w-0 text-toned">
              {{ part.label }}
            </DrillLink>
            <span class="figure text-end text-highlighted">{{ formatValue(part.value) }}</span>
            <span class="figure text-end text-xs text-muted">{{ share(part.value) }}</span>
          </li>
        </ul>
        <slot name="below" />
      </div>
    </div>
  </AppCard>
</template>

<style scoped>
.donut {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.25rem 2rem;
}

.donut-ring {
  position: relative;
  flex: none;
  width: 180px;
  height: 180px;
}

.ring-chart {
  width: 100%;
  height: 100%;
}

/* The middle is text on the page, so it keeps the app's type and stays crisp at any zoom. */
.ring-middle {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  padding: 0 2.5rem;
  text-align: center;
  pointer-events: none;
}

.legend {
  flex: 1;
  min-width: min(100%, 16rem);
}

.legend-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto 3rem;
  align-items: center;
  gap: 0.625rem;
  min-height: 2.25rem;
  border-bottom: 1px solid var(--border-default);
  font-size: 0.875rem;
}

.legend-row:last-child {
  border-bottom: 0;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

/* A phone sets the ring above its list, which then takes the card's whole width. */
@media (max-width: 639px) {
  .donut {
    flex-direction: column;
    align-items: stretch;
  }

  .donut-ring {
    width: 168px;
    height: 168px;
    margin-inline: auto;
  }
}
</style>
