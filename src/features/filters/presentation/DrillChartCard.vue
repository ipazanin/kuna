<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { monthAxisLabel } from '../../../shared/calendar/monthLabel'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import type { ChartPointSelection, ChartZoomWindow } from '../../../shared/ui/ChartCard.vue'
import { useFilters } from '../application/filterStore'
import type { DrillChart } from './chartDrill'

/**
 * A chart whose marks open the rows behind them. A click drills at once. On a phone a tap first
 * shows the tooltip and offers "View rows", and a second tap on the same mark drills, so one tap
 * never both shows a figure and leaves the screen.
 */
const props = defineProps<{
  chart: DrillChart
  title: string
  subtitle?: string
  definition?: string
  empty?: boolean
  height?: number
  phoneHeight?: number
}>()

const emit = defineEmits<{
  zoom: [window: ChartZoomWindow]
}>()

const { openDrill, drillLocation } = useFilters()
const phone = usePhoneLayout()
const chosen = shallowRef<ChartPointSelection | null>(null)

watch(
  () => props.chart,
  () => {
    chosen.value = null
  },
)

const readableCategory = monthAxisLabel('long')
const chosenLabel = computed(() => {
  const selection = chosen.value
  return selection === null ? '' : [selection.seriesName, readableCategory(selection.category)].filter((part) => part !== '').join(', ')
})

function linkAt(selection: ChartPointSelection): RouteLocationRaw | null {
  const target = props.chart.drillAt(selection)
  return target === null ? null : drillLocation(target)
}

function drill(selection: ChartPointSelection): void {
  const target = props.chart.drillAt(selection)
  if (target !== null) {
    void openDrill(target)
  }
}

function select(selection: ChartPointSelection): void {
  if (!phone.value) {
    drill(selection)
    return
  }
  const previous = chosen.value
  if (previous !== null && previous.seriesName === selection.seriesName && previous.dataIndex === selection.dataIndex) {
    drill(selection)
    return
  }
  chosen.value = props.chart.drillAt(selection) === null ? null : selection
}
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
    }"
    @select="select"
    @zoom="emit('zoom', $event)"
  >
    <template v-if="$slots.legend" #legend><slot name="legend" /></template>
    <template v-if="phone && chosen" #footer>
      <div class="flex items-center gap-3 border-t border-default px-4 py-2" data-testid="chart-drill">
        <p class="min-w-0 flex-1 truncate text-xs text-toned">{{ chosenLabel }}</p>
        <UButton label="View rows" icon="i-lucide-list" size="sm" color="neutral" variant="outline" @click="drill(chosen)" />
      </div>
    </template>
  </ChartCard>
</template>
