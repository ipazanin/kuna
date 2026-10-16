<script lang="ts">
export interface WindowCell {
  readonly perMonth: number
  readonly to: RouteLocationRaw | null
}

export interface WindowRow {
  readonly label: string
  /** One cell per column, in the columns' order. */
  readonly cells: readonly WindowCell[]
  /** Net and owner earns read better against the costs above them when set apart. */
  readonly emphasised?: boolean
}
</script>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'

defineProps<{
  columns: readonly string[]
  rows: readonly WindowRow[]
}>()

const STRIP_WIDTH = 132
const STRIP_INSET = 6
/** Last 3 months, last 12 months, all time: from the most recent to the longest view. */
const MARKS = ['strip-recent', 'strip-year', 'strip-all'] as const

/** Each row on its own scale, so the gap between the windows shows whatever the line's size. */
function stripPositions(cells: readonly WindowCell[]): number[] {
  const amounts = cells.map((cell) => cell.perMonth)
  const lowest = Math.min(...amounts)
  const span = Math.max(...amounts) - lowest
  return amounts.map((amount) =>
    span === 0 ? STRIP_WIDTH / 2 : STRIP_INSET + ((amount - lowest) / span) * (STRIP_WIDTH - STRIP_INSET * 2),
  )
}
</script>

<template>
  <div class="relative overflow-x-auto">
    <table class="data-table window-table w-full text-sm">
      <thead>
        <tr>
          <th scope="col" class="text-start">Per month</th>
          <th v-for="(column, index) in columns" :key="column" scope="col" class="text-end">
            <span class="inline-flex items-center justify-end gap-1.5">
              <span class="strip-key" :class="MARKS[index]" aria-hidden="true" />
              {{ column }}
            </span>
          </th>
          <th scope="col" class="hidden w-40 sm:table-cell"><span class="sr-only">Spread between the windows</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.label" :class="{ emphasised: row.emphasised }">
          <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
          <td v-for="(cell, index) in row.cells" :key="index" class="text-end">
            <DrillLink :to="cell.to" :label="`${row.label}, ${columns[index]}, open the rows`">
              <MoneyText :cents="cell.perMonth" precision="whole" :class="row.emphasised ? 'font-medium text-highlighted' : ''" />
            </DrillLink>
          </td>
          <td class="hidden sm:table-cell">
            <svg :width="STRIP_WIDTH" height="16" :viewBox="`0 0 ${STRIP_WIDTH} 16`" class="block" aria-hidden="true">
              <line :x1="STRIP_INSET" :x2="STRIP_WIDTH - STRIP_INSET" y1="8" y2="8" stroke="var(--chart-grid)" stroke-width="2" stroke-linecap="round" />
              <circle
                v-for="(position, index) in stripPositions(row.cells)"
                :key="index"
                :cx="position"
                cy="8"
                r="4"
                :class="MARKS[index]"
              />
            </svg>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Column headings may wrap, so the three figures fit a phone without scrolling. */
.window-table thead th {
  white-space: normal;
  vertical-align: bottom;
}

@media (max-width: 639px) {
  .window-table th,
  .window-table td {
    padding-inline: 0.5rem;
  }
}

.window-table tbody tr.emphasised:not(.emphasised + .emphasised) th,
.window-table tbody tr.emphasised:not(.emphasised + .emphasised) td {
  border-top-color: var(--border-strong);
}

.window-table tbody tr.emphasised th {
  color: var(--ink-strong);
  font-weight: 500;
}

.strip-key {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

circle.strip-recent,
.strip-key.strip-recent {
  fill: var(--accent);
  background: var(--accent);
}

circle.strip-year,
.strip-key.strip-year {
  fill: var(--surface-raised);
  stroke: var(--chart-ink);
  stroke-width: 1.5;
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--chart-ink);
}

circle.strip-all,
.strip-key.strip-all {
  fill: var(--chart-deemphasis);
  background: var(--chart-deemphasis);
}
</style>
