<script setup lang="ts">
import type { MonthFlowChart } from './monthFlowChart'
import { words } from './words'
import type { ChartRangeChoice } from '../../../../shared/charts/useChartRange'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'

/** Income, spending and saved each month with the savings rate, whose table writes the rate as a share since it does not read as money. */
withDefaults(
  defineProps<{
    title: string
    subtitle?: string | undefined
    chart: MonthFlowChart
    loading: boolean
    rangeChoice?: ChartRangeChoice | undefined
  }>(),
  { subtitle: undefined, rangeChoice: undefined },
)
</script>

<template>
  <ChartCard
    :title="title"
    v-bind="{ ...(subtitle === undefined ? {} : { subtitle }), ...(rangeChoice === undefined ? {} : { rangeChoice }) }"
    :description="chart.description"
    :option="chart.option"
    :loading="loading"
    :height="300"
    :phone-height="260"
  >
    <template #legend><ChartLegend :entries="chart.legend" /></template>
    <template #table>
      <caption class="sr-only">
        {{
          title
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="text-start">
            <span class="sr-only">{{ words.flow.monthHeading }}</span>
          </th>
          <th v-for="column in chart.table.columns" :key="column" scope="col" class="text-end">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in chart.table.rows" :key="row.month">
          <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
          <td v-for="(cell, index) in row.cells" :key="index" class="figure text-end">{{ cell }}</td>
        </tr>
      </tbody>
    </template>
  </ChartCard>
</template>
