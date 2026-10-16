<script lang="ts">
export interface ChartPointSelection {
  readonly seriesName: string
  /** The category under the pointer, usually a month or a category name. */
  readonly category: string
  readonly dataIndex: number
}

/** The first and last category the zoom slider keeps in view, as indexes into the axis. */
export interface ChartZoomWindow {
  readonly startIndex: number
  readonly endIndex: number
}
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import VChart from 'vue-echarts'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { ChartOption } from '../charts/echarts'
import { buildChartTheme } from '../charts/chartTheme'
import { chartTokens } from '../charts/chartTokens'
import InfoPopover from './InfoPopover.vue'

const props = withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    definition?: string
    /** What the chart shows, in words and euros, for a screen reader. */
    description: string
    option: ChartOption
    loading?: boolean
    empty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    /** Height of the plot including its axis labels, in pixels. */
    height?: number
  }>(),
  {
    loading: false,
    empty: false,
    emptyTitle: 'Nothing to show for this period',
    emptyDescription: 'Pick a longer period or clear a filter.',
    height: 260,
  },
)

const emit = defineEmits<{
  select: [selection: ChartPointSelection]
  zoom: [window: ChartZoomWindow]
}>()

const theme = computed(() => buildChartTheme(chartTokens()))
const chart = useTemplateRef('chart')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const renderedOption = computed<ChartOption>(() => ({
  aria: { enabled: true, label: { description: props.description } },
  animation: !reducedMotion,
  animationDuration: 450,
  animationDurationUpdate: 300,
  ...props.option,
}))

function onChartClick(event: { seriesName?: string; name?: string; dataIndex?: number }): void {
  emit('select', {
    seriesName: event.seriesName ?? '',
    category: event.name ?? '',
    dataIndex: event.dataIndex ?? -1,
  })
}

/** The slider reports percentages. The axis indexes it settled on are read back from the chart. */
function onDataZoom(): void {
  const [zoom] = (chart.value?.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] } | undefined)?.dataZoom ?? []
  if (zoom?.startValue !== undefined && zoom.endValue !== undefined) {
    emit('zoom', { startIndex: zoom.startValue, endIndex: zoom.endValue })
  }
}
</script>

<template>
  <section data-testid="chart-card" class="flex min-w-0 flex-col rounded-card border border-default bg-raised shadow-raised" :aria-busy="loading">
    <header class="flex flex-col gap-3 px-4 pt-4 sm:px-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h2 class="flex items-center gap-2 text-sm font-medium text-highlighted">
            {{ title }}
            <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-dimmed" aria-label="Loading" />
          </h2>
          <p v-if="subtitle" class="mt-0.5 text-xs text-muted">{{ subtitle }}</p>
        </div>
        <div v-if="definition" class="-my-1 -me-1.5 shrink-0">
          <InfoPopover :subject="title" :definition="definition" />
        </div>
      </div>
      <div v-if="$slots.legend && !empty">
        <slot name="legend" />
      </div>
    </header>

    <div class="chart-body px-2 pt-2 pb-3 sm:px-3" :style="{ height: `${height}px` }">
      <UEmpty
        v-if="empty && !loading"
        icon="i-lucide-chart-no-axes-column"
        :title="emptyTitle"
        :description="emptyDescription"
        variant="naked"
        size="sm"
        class="h-full"
      />
      <VChart
        v-else
        ref="chart"
        class="transition-opacity duration-200"
        :class="{ 'opacity-40': loading }"
        :option="renderedOption"
        :theme="theme"
        autoresize
        @click="onChartClick"
        @datazoom="onDataZoom"
      />
    </div>
  </section>
</template>
