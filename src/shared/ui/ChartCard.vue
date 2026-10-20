<script lang="ts">
export interface ChartPointSelection {
  /** Empty when the click landed between marks, which selects the whole month or row. */
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
import { computed, ref, useTemplateRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import VChart from 'vue-echarts'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import '../charts/echarts'
import type { ChartOption } from '../charts/echarts'
import { buildChartTheme } from '../charts/chartTheme'
import { chartTokens } from '../charts/chartTokens'
import { monthAxisLabel } from '../calendar/monthLabel'
import { usePhoneLayout } from '../layout/viewport'
import { formatWholeMoney } from '../money/moneyFormat'
import AppCard from './AppCard.vue'
import DrillLink from './DrillLink.vue'

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
    /** The height below the phone breakpoint, when the desktop one is too tall for a phone. */
    phoneHeight?: number
    /** How the table view writes a value. Money in whole units unless the chart says otherwise. */
    formatValue?: (value: number) => string
    /** Where a value in the table view leads, when the chart's marks drill. */
    linkAt?: (selection: ChartPointSelection) => RouteLocationRaw | null
  }>(),
  {
    formatValue: (value: number) => formatWholeMoney(value),
    linkAt: () => null,
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
const phone = usePhoneLayout()

const renderedOption = computed<ChartOption>(() => ({
  aria: { enabled: true, label: { description: props.description } },
  animation: !reducedMotion,
  animationDuration: 450,
  animationDurationUpdate: 300,
  ...(phone.value ? forPhone(props.option) : props.option),
}))

const plotHeight = computed(() => (phone.value ? (props.phoneHeight ?? props.height) : props.height))

type AxisOption = Record<string, unknown>

/**
 * A phone has a third of the width, so a month axis labels about four months, a value axis three
 * steps, and the tooltip stays inside the chart instead of widening the page.
 */
function forPhone(option: ChartOption): ChartOption {
  const tooltip = option.tooltip
  return {
    ...option,
    ...(tooltip === undefined || Array.isArray(tooltip) ? {} : { tooltip: { ...tooltip, confine: true, className: 'chart-tooltip' } }),
    xAxis: thinned(option.xAxis, true),
    yAxis: thinned(option.yAxis, false),
  } as ChartOption
}

function thinned(axis: unknown, horizontal: boolean): unknown {
  if (Array.isArray(axis)) {
    return axis.map((single) => thinned(single, horizontal))
  }
  if (typeof axis !== 'object' || axis === null) {
    return axis
  }
  const shown = axis as AxisOption
  if (shown.type === 'value') {
    return { ...shown, splitNumber: 3 }
  }
  // A category axis down the side names every bar, so only one along the bottom is thinned.
  if (shown.type === 'category' && horizontal && Array.isArray(shown.data) && shown.data.length > 6) {
    return { ...shown, axisLabel: { ...(shown.axisLabel as AxisOption | undefined), interval: Math.ceil(shown.data.length / 4) - 1 } }
  }
  return shown
}

function onChartClick(event: { seriesName?: string; name?: string; dataIndex?: number }): void {
  emit('select', {
    seriesName: event.seriesName ?? '',
    category: event.name ?? '',
    dataIndex: event.dataIndex ?? -1,
  })
}

/**
 * A click between marks still means the month or row under it. The pointer is turned into the
 * index of the category axis band that holds it, so a thin bar is not the only target.
 */
function onBandClick(event: { target?: unknown; offsetX: number; offsetY: number }): void {
  const instance = chart.value
  const pixel = [event.offsetX, event.offsetY]
  if (event.target || instance === null || !instance.containPixel({ gridIndex: 0 }, pixel)) {
    return
  }
  const alongX = isCategoryAxis(props.option.xAxis)
  const categories = categoryData(alongX ? props.option.xAxis : props.option.yAxis)
  const point = instance.convertFromPixel({ gridIndex: 0 }, pixel) as number[]
  const dataIndex = Math.round(point[alongX ? 0 : 1] ?? -1)
  const category = categories[dataIndex]
  if (category !== undefined) {
    emit('select', { seriesName: '', category: String(category), dataIndex })
  }
}

function firstAxis(axis: unknown): AxisOption | null {
  const single = Array.isArray(axis) ? axis[0] : axis
  return typeof single === 'object' && single !== null ? (single as AxisOption) : null
}

function isCategoryAxis(axis: unknown): boolean {
  return firstAxis(axis)?.type === 'category'
}

function categoryData(axis: unknown): readonly unknown[] {
  const data = firstAxis(axis)?.data
  return Array.isArray(data) ? data : []
}

const showTable = ref(false)
const readableCategory = monthAxisLabel('long')

interface TableCell {
  readonly value: number | null
  readonly to: RouteLocationRaw | null
}

/**
 * The chart's figures as rows of its category axis and columns of its named series, read from the
 * option itself so every chart has a table view without saying how. A bar list reads top down.
 */
const table = computed(() => {
  const alongX = isCategoryAxis(props.option.xAxis)
  const categories = categoryData(alongX ? props.option.xAxis : props.option.yAxis)
  const declared = props.option.series
  const series = (Array.isArray(declared) ? declared : declared === undefined ? [] : [declared]).flatMap((entry) => {
    const named = entry as { name?: unknown; data?: unknown }
    return typeof named.name === 'string' && named.name !== '' && Array.isArray(named.data) ? [{ name: named.name, data: named.data as unknown[] }] : []
  })
  const rows = categories.map((category, dataIndex) => ({
    label: readableCategory(String(category)),
    cells: series.map(
      (entry): TableCell => ({
        value: valueOf(entry.data[dataIndex]),
        to: props.linkAt({ seriesName: entry.name, category: String(category), dataIndex }),
      }),
    ),
  }))
  return { columns: series.map((entry) => entry.name), rows: alongX ? rows : rows.reverse() }
})

function valueOf(point: unknown): number | null {
  if (typeof point === 'number') return point
  const value = typeof point === 'object' && point !== null && 'value' in point ? point.value : null
  return typeof value === 'number' ? value : null
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
  <AppCard data-testid="chart-card" :title="title" :subtitle="subtitle" :definition="definition" :aria-busy="loading">
    <template #title>
      {{ title }}
      <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-dimmed" aria-label="Loading" />
    </template>
    <template v-if="!empty" #actions>
      <UButton
        :icon="showTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
        :label="showTable ? 'Chart' : 'Table'"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-my-1 text-muted"
        :aria-pressed="showTable"
        :aria-label="`Show ${title} as a table`"
        data-testid="chart-table-toggle"
        @click="showTable = !showTable"
      />
    </template>
    <template v-if="$slots.legend && !empty" #header>
      <slot name="legend" />
    </template>

    <div class="chart-body grow px-2 pt-2 pb-3 sm:px-3" :style="{ height: `${plotHeight}px` }">
      <UEmpty
        v-if="empty && !loading"
        icon="i-lucide-chart-no-axes-column"
        :title="emptyTitle"
        :description="emptyDescription"
        variant="naked"
        size="sm"
        class="h-full"
      />
      <div v-else-if="showTable" class="h-full overflow-auto" data-testid="chart-table">
        <table class="data-table w-full text-sm">
          <caption class="sr-only">{{ title }}</caption>
          <thead>
            <tr>
              <th scope="col" class="text-start"><span class="sr-only">Category</span></th>
              <th v-for="column in table.columns" :key="column" scope="col" class="text-end">{{ column }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in table.rows" :key="row.label">
              <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
              <td v-for="(cell, index) in row.cells" :key="index" class="figure text-end">
                <DrillLink v-if="cell.value !== null" :to="cell.to" :label="`${row.label}, ${table.columns[index]}, open the rows`">
                  {{ formatValue(cell.value) }}
                </DrillLink>
                <span v-else class="text-dimmed">–</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <VChart
        v-else
        ref="chart"
        class="transition-opacity duration-200"
        :class="{ 'opacity-40': loading }"
        :option="renderedOption"
        :theme="theme"
        autoresize
        @click="onChartClick"
        @zr:click="onBandClick"
        @datazoom="onDataZoom"
      />
    </div>
    <slot name="footer" />
  </AppCard>
</template>
