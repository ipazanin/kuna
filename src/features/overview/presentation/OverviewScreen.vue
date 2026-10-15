<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import UCard from '@nuxt/ui/components/Card.vue'

import { useCachedWorkbook } from '../../workbook/application/useCachedWorkbook'
import type { ChartOption } from '../../../shared/charts/echarts'

const { snapshot, loaded } = useCachedWorkbook()

const syncedAt = computed(() => {
  const stamp = snapshot.value?.meta.syncedAt
  return stamp === undefined ? '' : new Date(stamp).toLocaleString()
})

const rowsPerAccount = computed(() => {
  const counts = new Map<string, number>()
  for (const row of snapshot.value?.ledger ?? []) {
    const account = String(row.cells.account ?? 'unknown')
    counts.set(account, (counts.get(account) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))
})

const chartOption = computed<ChartOption>(() => ({
  grid: { left: 8, right: 8, top: 16, bottom: 8 },
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: rowsPerAccount.value.map(([account]) => account) },
  yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.2)' } } },
  series: [
    {
      type: 'bar',
      name: 'Ledger rows',
      data: rowsPerAccount.value.map(([, count]) => count),
      barMaxWidth: 48,
      itemStyle: { color: '#14b8a6' },
    },
  ],
}))
</script>

<template>
  <section class="space-y-6">
    <h1 data-testid="screen-title" class="text-2xl font-semibold text-highlighted">Overview</h1>

    <UCard v-if="loaded && snapshot === null">
      <p class="text-muted">No workbook is cached in this browser yet.</p>
    </UCard>

    <template v-else-if="snapshot !== null">
      <UCard>
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt class="text-sm text-muted">Workbook</dt>
            <dd class="font-medium text-highlighted">{{ snapshot.meta.title }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">As of</dt>
            <dd class="figure font-medium text-highlighted">{{ syncedAt }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Ledger rows</dt>
            <dd class="figure font-medium text-highlighted">{{ snapshot.ledger.length }}</dd>
          </div>
        </dl>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-medium text-highlighted">Ledger rows per account</h2>
        </template>
        <!-- vue-echarts sizes itself to 100% of its parent in an unlayered sheet, which beats a Tailwind class on the chart itself. -->
        <div class="h-64">
          <VChart data-testid="placeholder-chart" :option="chartOption" autoresize />
        </div>
      </UCard>
    </template>
  </section>
</template>
