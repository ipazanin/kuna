<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import { salaryMonthsChart } from './salaryCharts'
import type { SalaryMonthRow } from './salariesView'
import { words } from './words'

/** A year of paydays: the cost of each in the ring's parts, then the same as a table whose months open on the Month tab. */
const props = defineProps<{
  rows: readonly SalaryMonthRow[]
  year: number
  monthLink: (payday: string) => RouteLocationRaw
}>()

const chart = computed(() => salaryMonthsChart(props.rows, chartTokens()))
</script>

<template>
  <div class="flex flex-col gap-6">
    <DrillChartCard
      :chart="chart"
      :title="words.overTime.title(year)"
      :subtitle="words.overTime.subtitle"
      :definition="words.overTime.definition"
      :height="320"
      :phone-height="260"
      data-testid="salaries-over-time"
    >
      <template #legend><ChartLegend :entries="chart.legend" /></template>
    </DrillChartCard>

    <AppCard :title="words.overTime.paydays(year)" :subtitle="words.overTime.paydaysSubtitle" data-testid="salaries-months">
      <FigureTable class="px-1 pb-2 sm:px-2">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.overTime.paidIn }}</th>
            <th scope="col" class="text-end">{{ words.overTime.cost }}</th>
            <th scope="col" class="hidden text-end @lg:table-cell">{{ words.overTime.toEmployee }}</th>
            <th scope="col" class="hidden text-end @2xl:table-cell">{{ words.overTime.pensionSavings }}</th>
            <th scope="col" class="hidden text-end @md:table-cell">{{ words.overTime.toState }}</th>
            <th scope="col" class="text-end">{{ words.overTime.problems }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.payday" :data-payday="row.payday">
            <th scope="row" class="text-start font-normal">
              <DrillLink :to="monthLink(row.payday)" :label="words.overTime.openMonth(row.label)" class="text-highlighted">{{ row.label }}</DrillLink>
            </th>
            <td class="text-end"><MoneyText :cents="row.cost" /></td>
            <td class="hidden text-end @lg:table-cell"><MoneyText :cents="row.parts.employee" /></td>
            <td class="hidden text-end @2xl:table-cell"><MoneyText :cents="row.parts.pensionSavings" /></td>
            <td class="hidden text-end @md:table-cell"><MoneyText :cents="row.toState" /></td>
            <td class="figure text-end" :class="row.problems === 0 ? 'text-muted' : 'text-error'">{{ row.problems }}</td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>
  </div>
</template>
