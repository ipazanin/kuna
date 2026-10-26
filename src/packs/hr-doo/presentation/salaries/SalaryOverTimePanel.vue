<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { chartTokens } from '../../../../shared/charts/chartTokens'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import DrillChartCard from '../../../../features/filters/presentation/DrillChartCard.vue'
import { salaryMonthsChart } from './salaryCharts'
import type { SalaryMonthRow } from './salariesView'

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
      :title="`Cost to the company by payday, ${year}`"
      subtitle="Each month a payroll was paid in, stacked by where its money went. A band opens its bank rows."
      definition="The figures are the payslip’s where one was read, else the app’s, else the bank’s, as on the Month tab. The month still running is hatched and may not be paid yet."
      :height="320"
      :phone-height="260"
      data-testid="salaries-over-time"
    >
      <template #legend><ChartLegend :entries="chart.legend" /></template>
    </DrillChartCard>

    <AppCard :title="`Paydays of ${year}`" subtitle="A month opens on the Month tab." data-testid="salaries-months">
      <div class="@container px-1 pb-2 sm:px-2">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th scope="col" class="text-start">Paid in</th>
              <th scope="col" class="text-end">Cost</th>
              <th scope="col" class="hidden text-end @lg:table-cell">To the employee</th>
              <th scope="col" class="hidden text-end @2xl:table-cell">Pension savings</th>
              <th scope="col" class="hidden text-end @md:table-cell">To the state</th>
              <th scope="col" class="text-end">Problems</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.payday" :data-payday="row.payday">
              <th scope="row" class="text-start font-normal">
                <DrillLink :to="monthLink(row.payday)" :label="`${row.label}, open the month`" class="text-highlighted">{{ row.label }}</DrillLink>
              </th>
              <td class="text-end"><MoneyText :cents="row.cost" /></td>
              <td class="hidden text-end @lg:table-cell"><MoneyText :cents="row.parts.employee" /></td>
              <td class="hidden text-end @2xl:table-cell"><MoneyText :cents="row.parts.pensionSavings" /></td>
              <td class="hidden text-end @md:table-cell"><MoneyText :cents="row.toState" /></td>
              <td class="figure text-end" :class="row.problems === 0 ? 'text-muted' : 'text-negative'">{{ row.problems }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  </div>
</template>
