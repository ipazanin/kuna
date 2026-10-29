<script lang="ts">
import type { PeriodPreset } from '../domain/periodPresets'

export const PRESET_LABELS: Readonly<Record<PeriodPreset, string>> = {
  l3: 'Last 3 months',
  l12: 'Last 12 months',
  year: 'Year',
  quarter: 'Quarter',
  custom: 'Custom',
  all: 'All time',
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import type { Period, Quarter } from '../domain/filterState'
import { periodInWords } from '../domain/periodInWords'
import { ledgerYears, periodWithPreset } from '../domain/periodPresets'

const period = defineModel<Period>('period', { required: true })

const props = withDefaults(
  defineProps<{
    window: LedgerWindow
    /** The presets this screen offers, in the bar's order. */
    presets?: readonly PeriodPreset[]
    /** One control per row, the presets wrapping instead of scrolling, as in the phone's filter sheet. */
    stacked?: boolean
  }>(),
  { presets: () => ['l3', 'l12', 'year', 'quarter', 'custom', 'all'], stacked: false },
)

const rangeText = computed(() => periodInWords(period.value, props.window))

const QUARTERS = [
  { label: 'Q1', value: 1 },
  { label: 'Q2', value: 2 },
  { label: 'Q3', value: 3 },
  { label: 'Q4', value: 4 },
]

const yearItems = computed(() => ledgerYears(props.window))
const selectedYear = computed({
  get: () => ('year' in period.value ? period.value.year : 0),
  set: (year: number) => {
    if (period.value.preset === 'year' || period.value.preset === 'quarter') {
      period.value = { ...period.value, year }
    }
  },
})

const selectedQuarter = computed({
  get: () => (period.value.preset === 'quarter' ? period.value.quarter : 1) as number,
  set: (quarter: number) => {
    if (period.value.preset === 'quarter') {
      period.value = { ...period.value, quarter: quarter as Quarter }
    }
  },
})

const customRange = computed(() => (period.value.preset === 'custom' ? period.value.range : null))

/** Moving one end past the other drags the other along, so the range never turns inside out. */
function setCustomEnd(end: 'from' | 'to', text: string | number): void {
  const date = parseCivilDate(String(text))
  const range = customRange.value
  if (date === null || range === null) {
    return
  }
  const from = end === 'from' ? date : date < range.from ? date : range.from
  const to = end === 'to' ? date : date > range.to ? date : range.to
  period.value = { preset: 'custom', range: { from, to } }
}

function choosePreset(preset: PeriodPreset): void {
  if (preset !== period.value.preset) {
    period.value = periodWithPreset(period.value, preset, props.window)
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="period-bar">
    <div role="group" aria-label="Period" class="presets flex max-w-full rounded-control border border-default bg-raised p-0.5" :class="stacked ? 'presets-stacked w-full' : 'overflow-x-auto'">
      <button v-for="preset in presets" :key="preset" type="button" class="preset" :aria-pressed="period.preset === preset" @click="choosePreset(preset)">
        {{ PRESET_LABELS[preset] }}
      </button>
    </div>

    <div v-if="period.preset === 'year' || period.preset === 'quarter'" class="flex items-center gap-2">
      <USelect v-model="selectedYear" :items="yearItems" size="sm" aria-label="Year" class="w-24" />
      <USelect v-if="period.preset === 'quarter'" v-model="selectedQuarter" :items="QUARTERS" size="sm" aria-label="Quarter" class="w-20" />
    </div>

    <div v-if="customRange" class="flex flex-wrap items-center gap-2">
      <UInput type="date" size="sm" aria-label="From" :model-value="customRange.from" class="w-40" @change="(event: Event) => setCustomEnd('from', (event.target as HTMLInputElement).value)" />
      <span class="text-xs text-muted">to</span>
      <UInput type="date" size="sm" aria-label="To" :model-value="customRange.to" class="w-40" @change="(event: Event) => setCustomEnd('to', (event.target as HTMLInputElement).value)" />
    </div>

    <p v-if="!customRange" class="figure text-sm text-toned" data-testid="period-range">{{ rangeText }}</p>
  </div>
</template>

<style scoped>
.presets {
  scrollbar-width: none;
}

.presets-stacked {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
  gap: 0.125rem;
}

.preset {
  flex-shrink: 0;
  padding: 0.3125rem 0.625rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--ink-muted);
  white-space: nowrap;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.preset:hover {
  color: var(--ink-strong);
  background: var(--surface-elevated);
}

.preset[aria-pressed='true'] {
  color: var(--accent-strong);
  background: var(--accent-wash);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  font-weight: 500;
}

.preset:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
