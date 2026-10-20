<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { CostChange } from '../domain/costGroups'

export interface CostLine {
  readonly key: string
  readonly name: string
  /** The bar's colour, the category's bucket. */
  readonly colour: string
  readonly current: number
  readonly prior: number | null
  readonly change: CostChange | null
  readonly to: RouteLocationRaw | null
}

export interface CostSection {
  readonly key: string
  readonly title: string
  readonly total: number
  readonly priorTotal: number | null
  readonly change: CostChange | null
  readonly lines: readonly CostLine[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { formatPercent, formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import type { LegendEntry } from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'

/**
 * Cost by category as a list of bars under their buckets, each against a mark for the period
 * before. Every bar grows from zero on one shared scale, and the change is written out beside it.
 */
const props = defineProps<{
  sections: readonly CostSection[]
  subtitle: string
  definition: string
  legend: readonly LegendEntry[]
  /** False without a period before, which drops the prior marks and the change. */
  compared: boolean
}>()

const scale = computed(() => Math.max(1, ...props.sections.flatMap((section) => section.lines.flatMap((line) => [line.current, line.prior ?? 0]))))

const summary = computed(() => {
  const lines = props.sections.flatMap((section) => section.lines)
  const largest = lines.reduce<CostLine | null>((best, line) => (best === null || line.current > best.current ? line : best), null)
  if (largest === null) return 'Nothing was spent in this period'
  return `${lines.length} ${lines.length === 1 ? 'category' : 'categories'}, the largest ${largest.name} at ${formatWholeMoney(largest.current)}`
})

function widthOf(amount: number): string {
  return `${(Math.max(0, amount) / scale.value) * 100}%`
}

function changeText(change: CostChange | null): string {
  if (change === null) return ''
  return change === 'new' ? 'new' : formatPercent(change, 'always')
}
</script>

<template>
  <AppCard title="Cost by category" :subtitle="subtitle" :definition="definition" collapse-id="spending.categories" :summary="summary" data-testid="cost-by-category">
    <template #header>
      <ChartLegend :entries="legend" />
    </template>

    <p v-if="sections.length === 0" class="px-5 py-8 text-sm text-muted">Nothing was spent in this period.</p>
    <div v-else class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
      <section v-for="section in sections" :key="section.key" :aria-label="section.title">
        <h3 class="cost-row cost-heading">
          <span class="cost-name">{{ section.title }}</span>
          <span class="cost-amount figure">{{ formatWholeMoney(section.total) }}</span>
          <span v-if="compared" class="cost-change figure">{{ changeText(section.change) }}</span>
        </h3>
        <ul>
          <li v-for="line in section.lines" :key="line.key" class="cost-row" data-testid="cost-line">
            <DrillLink :to="line.to" class="cost-name min-w-0 text-toned">
              <span class="block truncate">{{ line.name }}</span>
            </DrillLink>
            <span class="cost-bar" aria-hidden="true">
              <span v-if="compared && line.prior !== null" class="cost-prior" :style="{ width: widthOf(line.prior) }" />
              <span class="cost-current" :style="{ width: widthOf(line.current), background: line.colour }" />
            </span>
            <span class="cost-amount figure text-highlighted">
              {{ formatWholeMoney(line.current) }}
              <span v-if="compared && line.prior !== null" class="sr-only">, before {{ formatWholeMoney(line.prior) }}</span>
            </span>
            <span v-if="compared" class="cost-change figure">{{ changeText(line.change) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </AppCard>
</template>

<style scoped>
.cost-row {
  display: grid;
  grid-template-columns: minmax(7rem, 13rem) minmax(0, 1fr) 5.5rem 3.75rem;
  grid-template-areas: 'name bar amount change';
  align-items: center;
  column-gap: 0.75rem;
  min-height: 1.875rem;
  font-size: 0.8125rem;
}

.cost-heading {
  margin-bottom: 0.25rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--border-default);
  font-weight: 500;
  color: var(--ink-strong);
}

.cost-name {
  grid-area: name;
}

.cost-bar {
  position: relative;
  grid-area: bar;
  display: block;
  height: 14px;
}

/* The period before as an outline, so it reads on both themes behind the filled bar. */
.cost-prior {
  position: absolute;
  inset-block: 0;
  left: 0;
  border: 1.5px solid var(--chart-ink-muted);
  border-left: none;
  border-radius: 0 3px 3px 0;
}

.cost-current {
  position: absolute;
  top: 3px;
  left: 0;
  height: 8px;
  border-radius: 0 4px 4px 0;
}

.cost-amount {
  grid-area: amount;
  text-align: end;
}

.cost-change {
  grid-area: change;
  font-size: 0.75rem;
  color: var(--ink-muted);
  text-align: end;
}

/* A phone gives the name its own line and the bar the full width under it. */
@media (max-width: 639px) {
  .cost-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-areas:
      'name amount change'
      'bar bar bar';
    row-gap: 0.25rem;
    padding-block: 0.25rem;
  }

  .cost-heading {
    grid-template-areas: 'name amount change';
  }
}
</style>
