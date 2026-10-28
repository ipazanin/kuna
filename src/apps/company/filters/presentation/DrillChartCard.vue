<script setup lang="ts">
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import type { ChartZoomWindow } from '../../../../shared/ui/ChartCard.vue'
import ChartDrillBar from './ChartDrillBar.vue'
import type { DrillChart } from './chartDrill'
import { useChartDrill } from './useChartDrill'

/** A chart in its own card whose marks open the rows behind them, as `useChartDrill` describes. */
const props = defineProps<{
  chart: DrillChart
  title: string
  subtitle?: string
  definition?: string
  empty?: boolean
  height?: number
  phoneHeight?: number
  /** Makes the chart collapsible under this id, as ChartCard's collapse id does. */
  collapseId?: string
  summary?: string
  startCollapsed?: boolean
}>()

const emit = defineEmits<{
  zoom: [window: ChartZoomWindow]
}>()

const { phone, chosen, chosenLabel, linkAt, drill, select } = useChartDrill(() => props.chart)
</script>

<template>
  <ChartCard
    :title="title"
    :option="chart.option"
    :description="chart.description"
    :link-at="linkAt"
    v-bind="{
      ...(chart.formatValue === undefined ? {} : { formatValue: chart.formatValue }),
      ...(subtitle === undefined ? {} : { subtitle }),
      ...(definition === undefined ? {} : { definition }),
      ...(empty === undefined ? {} : { empty }),
      ...(height === undefined ? {} : { height }),
      ...(phoneHeight === undefined ? {} : { phoneHeight }),
      ...(collapseId === undefined ? {} : { collapseId, summary, startCollapsed }),
    }"
    @select="select"
    @zoom="emit('zoom', $event)"
  >
    <template v-if="$slots.legend" #legend><slot name="legend" /></template>
    <template v-if="phone && chosen" #footer>
      <ChartDrillBar :label="chosenLabel" @view="drill(chosen)" />
    </template>
  </ChartCard>
</template>
