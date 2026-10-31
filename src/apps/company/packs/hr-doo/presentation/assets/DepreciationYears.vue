<script lang="ts">
export interface DepreciationChargeLine {
  readonly key: string
  readonly asset: string
  /** How the charge came about, such as "9 months at 50%". */
  readonly basis: string
  readonly amount: number
  /** What the profit tax allows, shown only when it is less than the charge. */
  readonly deductible: number | null
}

export interface DepreciationYearLine {
  readonly year: number
  readonly total: number
  readonly when: 'past' | 'current' | 'ahead'
  readonly charges: readonly DepreciationChargeLine[]
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { words } from './words'

/** One figure per year, which opens on the charge of each asset behind it. */
const props = defineProps<{
  years: readonly DepreciationYearLine[]
}>()

const open = ref(new Set(props.years.filter((line) => line.when === 'current').map((line) => line.year)))

function toggle(year: number): void {
  const next = new Set(open.value)
  if (!next.delete(year)) {
    next.add(year)
  }
  open.value = next
}

const WHEN = { past: '', current: words.years.thisYear, ahead: words.years.toCome } as const
</script>

<template>
  <ul class="flex flex-col" data-testid="depreciation-years">
    <li v-for="line in years" :key="line.year" class="year-row">
      <button type="button" class="year-toggle" :aria-expanded="open.has(line.year)" :aria-controls="`depreciation-${line.year}`" data-testid="depreciation-year-toggle" @click="toggle(line.year)">
        <UIcon name="i-lucide-chevron-right" class="year-chevron size-4 shrink-0 text-muted" :class="{ 'is-open': open.has(line.year) }" aria-hidden="true" />
        <span class="figure text-sm font-medium text-highlighted">{{ line.year }}</span>
        <span v-if="WHEN[line.when]" class="text-xs text-muted">{{ WHEN[line.when] }}</span>
        <MoneyText :cents="line.total" class="ms-auto text-sm font-medium text-highlighted" />
      </button>
      <ul v-if="open.has(line.year)" :id="`depreciation-${line.year}`" class="charge-list">
        <li v-for="charge in line.charges" :key="charge.key" class="charge-row">
          <div class="min-w-0">
            <p class="truncate text-sm text-toned">{{ charge.asset }}</p>
            <p class="text-xs text-muted">
              {{ charge.basis }}<template v-if="charge.deductible !== null">{{ words.years.deductible }}<MoneyText :cents="charge.deductible" /></template>
            </p>
          </div>
          <MoneyText :cents="charge.amount" class="text-sm text-toned" />
        </li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.year-row + .year-row {
  border-top: 1px solid var(--border-default);
}

.year-toggle {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  border-radius: var(--radius-control);
  text-align: start;
}

.year-toggle:hover .year-chevron {
  color: var(--ink);
}

.year-chevron {
  transition: transform 120ms ease;
}

.year-chevron.is-open {
  transform: rotate(90deg);
}

.charge-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0 0 0.75rem 1.5rem;
}

.charge-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
</style>
