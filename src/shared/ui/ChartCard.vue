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
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { ChartOption } from '../charts/echarts'
import { categoryData, isCategoryAxis } from '../charts/chartAxes'
import { monthAxisLabel } from '../calendar/monthLabel'
import { usePhoneLayout } from '../layout/viewport'
import { formatMoney } from '../money/moneyFormat'
import AppCard from './AppCard.vue'
import ChartCanvas from './ChartCanvas.vue'
import DrillLink from './DrillLink.vue'
import FigureTable from './FigureTable.vue'
import { words } from './words'

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
    /** How the table view writes a value. Money with its cents unless the chart says otherwise. */
    formatValue?: (value: number) => string
    /** Where a value in the table view leads, when the chart's marks drill. */
    linkAt?: (selection: ChartPointSelection) => RouteLocationRaw | null
    /** Makes the chart collapsible, as AppCard's collapse id does, under its own id such as "year.konto". */
    collapseId?: string
    /** The one line the collapsed chart shows under its title. */
    summary?: string
    startCollapsed?: boolean
    reveal?: boolean
  }>(),
  {
    formatValue: (value: number) => formatMoney(value),
    linkAt: () => null,
    loading: false,
    empty: false,
    emptyTitle: words.chart.emptyTitle,
    emptyDescription: words.chart.emptyDescription,
    height: 260,
    startCollapsed: false,
    reveal: false,
  },
)

const emit = defineEmits<{
  select: [selection: ChartPointSelection]
  zoom: [window: ChartZoomWindow]
}>()

const phone = usePhoneLayout()
const plotHeight = computed(() => (phone.value ? (props.phoneHeight ?? props.height) : props.height))

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
    cells: series.map((entry): TableCell => ({
      value: valueOf(entry.data[dataIndex]),
      to: props.linkAt({ seriesName: entry.name, category: String(category), dataIndex }),
    })),
  }))
  return { columns: series.map((entry) => entry.name), rows: alongX ? rows : rows.reverse() }
})

function valueOf(point: unknown): number | null {
  if (typeof point === 'number') return point
  const value = typeof point === 'object' && point !== null && 'value' in point ? point.value : null
  return typeof value === 'number' ? value : null
}
</script>

<template>
  <AppCard
    data-testid="chart-card"
    :title="title"
    :subtitle="subtitle"
    :definition="definition"
    :aria-busy="loading"
    v-bind="collapseId === undefined ? {} : { collapseId, summary, startCollapsed, reveal }"
  >
    <template #title>
      {{ title }}
      <UIcon v-if="loading" name="i-lucide-loader-circle" class="size-3.5 animate-spin text-muted" :aria-label="words.chart.loading" />
    </template>
    <template v-if="!empty" #actions>
      <UButton
        :icon="showTable ? 'i-lucide-chart-column' : 'i-lucide-table'"
        :label="showTable ? words.chart.chart : words.chart.table"
        color="neutral"
        variant="ghost"
        size="xs"
        class="-my-1 text-muted"
        :aria-pressed="showTable"
        :aria-label="words.chart.asTable(title)"
        data-testid="chart-table-toggle"
        @click="showTable = !showTable"
      />
    </template>
    <template v-if="$slots.legend && !empty" #header>
      <slot name="legend" />
    </template>

    <div class="chart-body grow px-2 pt-2 pb-3 sm:px-3" :style="{ height: `${plotHeight}px` }">
      <UEmpty v-if="empty && !loading" icon="i-lucide-chart-no-axes-column" :title="emptyTitle" :description="emptyDescription" variant="naked" size="sm" class="h-full" />
      <FigureTable v-else-if="showTable" class="h-full overflow-auto" data-testid="chart-table">
        <caption class="sr-only">
          {{
            title
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col" class="text-start">
              <span class="sr-only">{{ words.chart.category }}</span>
            </th>
            <th v-for="column in table.columns" :key="column" scope="col" class="text-end">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table.rows" :key="row.label">
            <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
            <td v-for="(cell, index) in row.cells" :key="index" class="figure text-end">
              <DrillLink v-if="cell.value !== null" :to="cell.to" :label="words.chart.openRows(row.label, table.columns[index] ?? '')">
                {{ formatValue(cell.value) }}
              </DrillLink>
              <span v-else class="text-muted">–</span>
            </td>
          </tr>
        </tbody>
      </FigureTable>
      <ChartCanvas
        v-else
        class="transition-opacity duration-fade"
        :class="{ 'opacity-40': loading }"
        :option="option"
        :description="description"
        @select="emit('select', $event)"
        @zoom="emit('zoom', $event)"
      />
    </div>
    <slot name="footer" />
  </AppCard>
</template>
