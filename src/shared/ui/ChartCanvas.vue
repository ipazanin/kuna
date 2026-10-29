<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import VChart from 'vue-echarts'

import '../charts/echarts'
import type { ChartOption } from '../charts/echarts'
import { categoryData, isCategoryAxis } from '../charts/chartAxes'
import { buildChartTheme } from '../charts/chartTheme'
import { chartTokens } from '../charts/chartTokens'
import { usePhoneLayout } from '../layout/viewport'
import type { ChartPointSelection, ChartZoomWindow } from './ChartCard.vue'

/** One ECharts chart in the app's theme. A click on a mark, or between marks, selects the category under it. */
const props = defineProps<{
  option: ChartOption
  /** What the chart shows, in words and euros, for a screen reader. */
  description: string
}>()

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
  // A category axis down the side names every bar, so only one along the bottom is thinned, unless its chart picks its own labels.
  const label = shown.axisLabel as AxisOption | undefined
  if (shown.type === 'category' && horizontal && Array.isArray(shown.data) && shown.data.length > 6 && label?.interval === undefined) {
    return { ...shown, axisLabel: { ...label, interval: Math.ceil(shown.data.length / 4) - 1 } }
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

/** The slider reports percentages. The axis indexes it settled on are read back from the chart. */
function onDataZoom(): void {
  const [zoom] = (chart.value?.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] } | undefined)?.dataZoom ?? []
  if (zoom?.startValue !== undefined && zoom.endValue !== undefined) {
    emit('zoom', { startIndex: zoom.startValue, endIndex: zoom.endValue })
  }
}
</script>

<template>
  <VChart ref="chart" :option="renderedOption" :theme="theme" autoresize @click="onChartClick" @zr:click="onBandClick" @datazoom="onDataZoom" />
</template>
