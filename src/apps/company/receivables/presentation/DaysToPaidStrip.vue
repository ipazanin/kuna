<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface DaysToPaidRow {
  readonly key: string
  readonly name: string
  /** Days each invoice paid in the period took, shortest first. */
  readonly days: readonly number[]
  readonly median: number | null
  readonly mean: number | null
  /** The client's payments in the period. */
  readonly to: RouteLocationRaw | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { formatDays } from '../../../../shared/money/moneyFormat'
import DrillLink from '../../../../shared/ui/DrillLink.vue'

/** One row per client: every paid invoice as a dot on a shared scale of days, the median marked. */
const props = defineProps<{
  rows: readonly DaysToPaidRow[]
}>()

const scaleEnd = computed(() => Math.max(30, ...props.rows.flatMap((row) => row.days)))
const ticks = computed(() => {
  const step = scaleEnd.value <= 60 ? 15 : scaleEnd.value <= 150 ? 30 : 60
  return Array.from({ length: Math.floor(scaleEnd.value / step) + 1 }, (_, index) => index * step)
})

/** Where a number of days sits along the strip, as a share of its width. */
function at(days: number): string {
  return `${(days / scaleEnd.value) * 100}%`
}

function daysText(days: number | null): string {
  return days === null ? '–' : `${formatDays(days)} ${days === 1 ? 'day' : 'days'}`
}
</script>

<template>
  <div data-testid="days-to-paid">
    <div class="days-row days-scale" aria-hidden="true">
      <span class="days-strip-area">
        <span class="strip ticks">
          <span v-for="tick in ticks" :key="tick" class="tick-label" :style="{ left: at(tick) }">{{ tick }}</span>
        </span>
      </span>
    </div>
    <ul>
      <li v-for="row in rows" :key="row.key" class="days-row">
        <span class="days-name truncate text-sm text-toned">{{ row.name }}</span>
        <span class="days-strip-area">
          <span class="strip" role="img" :aria-label="`${row.name}, days each invoice took: ${row.days.map((days) => daysText(days)).join(', ') || 'no invoice paid'}`">
            <span v-for="tick in ticks" :key="tick" class="tick" :style="{ left: at(tick) }" />
            <span v-for="(days, index) in row.days" :key="index" class="dot" :style="{ left: at(days) }" :title="daysText(days)" />
            <span v-if="row.median !== null" class="median" :style="{ left: at(row.median) }" :title="`Median ${daysText(row.median)}`" />
          </span>
        </span>
        <span class="days-figure text-end">
          <DrillLink :to="row.to" :label="`${row.name}, median ${daysText(row.median)}, open the payments in the period`">
            <span class="figure text-sm font-medium text-highlighted">{{ daysText(row.median) }}</span>
          </DrillLink>
          <span class="figure block text-xs text-muted">mean {{ daysText(row.mean) }}, {{ row.days.length }} paid</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.days-row {
  display: grid;
  grid-template-columns: minmax(6rem, 10rem) minmax(8rem, 1fr) 9rem;
  grid-template-areas: 'name strip figure';
  align-items: center;
  column-gap: 1rem;
  padding: 0.5rem 0.75rem;
}

li.days-row + li.days-row {
  border-top: 1px solid var(--border-default);
}

.days-scale {
  padding-block: 0 0.25rem;
}

.days-name {
  grid-area: name;
}

.days-strip-area {
  grid-area: strip;
  min-width: 0;
}

.days-figure {
  grid-area: figure;
}

@media (max-width: 639px) {
  .days-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'name figure'
      'strip strip';
    row-gap: 0.25rem;
  }

  .days-scale {
    grid-template-areas: 'strip strip';
  }
}

/* The strip keeps 6 px clear at each end, so a dot at zero or at the longest wait is not cut. */
.strip {
  position: relative;
  display: block;
  height: 1.75rem;
  margin-inline: 6px;
}

.strip::before {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 50%;
  border-top: 1px solid var(--chart-axis);
}

.ticks {
  height: 1rem;
}

.ticks::before {
  display: none;
}

.tick-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 0.6875rem;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--chart-ink-muted);
}

.tick {
  position: absolute;
  top: calc(50% - 3px);
  height: 7px;
  border-left: 1px solid var(--chart-axis);
}

.dot {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: color-mix(in srgb, var(--series-3) 72%, transparent);
  box-shadow: 0 0 0 2px var(--surface-raised);
}

.median {
  position: absolute;
  top: 3px;
  bottom: 3px;
  width: 2px;
  border-radius: 1px;
  transform: translateX(-50%);
  background: var(--chart-ink);
}
</style>
