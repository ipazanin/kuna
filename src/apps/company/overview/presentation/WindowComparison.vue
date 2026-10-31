<script lang="ts">
export interface WindowCell {
  readonly perMonth: number
  readonly to: RouteLocationRaw | null
}

export interface WindowRow {
  readonly label: string
  /** One cell per column, in the columns' order. */
  readonly cells: readonly WindowCell[]
  /** The last 3 months against the last 12, as a fraction. Null when the 12-month figure is zero. */
  readonly recentChange: number | null
  /** Net and owner earns read better against the costs above them when set apart. */
  readonly emphasised?: boolean
}
</script>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import { formatPercent } from '../../../../shared/money/moneyFormat'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { words } from './words'

defineProps<{
  columns: readonly string[]
  rows: readonly WindowRow[]
}>()

/** Every row's bar shares one scale, so equal changes look equal. Beyond it a bar stops at the end. */
const SCALE = 0.5

function barStyle(change: number): Record<string, string> {
  const reach = (Math.min(Math.abs(change), SCALE) / SCALE) * 50
  return change >= 0 ? { left: '50%', width: `${reach}%` } : { right: '50%', width: `${reach}%` }
}
</script>

<template>
  <FigureTable class="window-table">
    <thead>
      <tr>
        <th scope="col" class="text-start">{{ words.typicalMonth.perMonth }}</th>
        <th v-for="column in columns" :key="column" scope="col" class="text-end">{{ column }}</th>
        <th scope="col" class="hidden text-end @md:table-cell">{{ words.typicalMonth.last3Against12 }}</th>
        <th scope="col" class="hidden w-32 @xl:table-cell">
          <span class="sr-only">{{ words.typicalMonth.scale }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.label" :class="{ emphasised: row.emphasised }">
        <th scope="row" class="cell-wraps text-start font-normal text-toned">
          {{ row.label }}
          <span v-if="row.recentChange !== null" class="figure block text-xs font-normal text-muted @md:hidden">
            {{ words.typicalMonth.changeAgainst12(formatPercent(row.recentChange, 'always')) }}
          </span>
        </th>
        <td v-for="(cell, index) in row.cells" :key="index" class="text-end">
          <DrillLink :to="cell.to" :label="words.typicalMonth.openRows(row.label, columns[index] ?? '')">
            <MoneyText :cents="cell.perMonth" :class="row.emphasised ? 'font-medium text-highlighted' : ''" />
          </DrillLink>
        </td>
        <td class="figure hidden text-end text-toned @md:table-cell">
          {{ row.recentChange === null ? '–' : formatPercent(row.recentChange, 'always') }}
        </td>
        <td class="hidden @xl:table-cell">
          <span class="change-scale" aria-hidden="true">
            <span v-if="row.recentChange !== null" class="change-bar" :style="barStyle(row.recentChange)" />
          </span>
        </td>
      </tr>
    </tbody>
  </FigureTable>
</template>

<style scoped>
/* Column headings may wrap, so the figures fit a phone without scrolling. */
.window-table thead th {
  white-space: normal;
  vertical-align: bottom;
}

.window-table tbody tr.emphasised:not(.emphasised + .emphasised) th,
.window-table tbody tr.emphasised:not(.emphasised + .emphasised) td {
  border-top-color: var(--border-strong);
}

.window-table tbody tr.emphasised th {
  color: var(--ink-strong);
  font-weight: 500;
}

/* A track centred on no change, with a tick at zero. */
.change-scale {
  position: relative;
  display: block;
  width: 8rem;
  height: 8px;
  border-radius: 4px;
  background: var(--chart-grid);
}

.change-scale::after {
  content: '';
  position: absolute;
  inset-block: -3px;
  left: calc(50% - 0.5px);
  width: 1px;
  background: var(--chart-axis);
}

.change-bar {
  position: absolute;
  inset-block: 0;
  border-radius: 4px;
  background: var(--chart-ink-muted);
}
</style>
