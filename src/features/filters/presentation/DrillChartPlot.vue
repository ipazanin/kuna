<script setup lang="ts">
import { computed } from 'vue'

import ChartCanvas from '../../../shared/ui/ChartCanvas.vue'
import ChartDrillBar from './ChartDrillBar.vue'
import type { DrillChart } from './chartDrill'
import { useChartDrill } from './useChartDrill'

/** A chart set inside another card, whose marks open the rows behind them as `useChartDrill` describes. */
const props = defineProps<{
  chart: DrillChart
  /** Height of the plot including its axis labels, in pixels. */
  height: number
  /** The height below the phone breakpoint. */
  phoneHeight?: number
}>()

const { phone, chosen, chosenLabel, drill, select } = useChartDrill(() => props.chart)
const plotHeight = computed(() => (phone.value ? (props.phoneHeight ?? props.height) : props.height))
</script>

<template>
  <div class="flex min-w-0 flex-col">
    <div class="chart-body" :style="{ height: `${plotHeight}px` }">
      <ChartCanvas :option="chart.option" :description="chart.description" @select="select" />
    </div>
    <ChartDrillBar v-if="phone && chosen" :label="chosenLabel" class="-mx-4 sm:-mx-5" @view="drill(chosen)" />
  </div>
</template>
