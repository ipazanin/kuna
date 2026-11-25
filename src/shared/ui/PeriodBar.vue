<script setup lang="ts">
import { computed } from 'vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate } from '../calendar/civilDate'
import { withRangeEnd } from '../calendar/dateRange'
import type { LedgerWindow } from '../calendar/ledgerWindow'
import { parseMonthKey } from '../calendar/monthKey'
import { monthLabel } from '../calendar/monthLabel'
import type { Period, Quarter } from '../calendar/period'
import { periodInWords } from '../calendar/periodInWords'
import { ledgerMonths, ledgerYears, periodWithPreset } from '../calendar/periodPresets'
import type { PeriodPreset } from '../calendar/periodPresets'
import ChoiceButtons from './ChoiceButtons.vue'
import DayField from './DayField.vue'
import { words as uiWords } from './words'

const words = uiWords.periodBar

const period = defineModel<Period>('period', { required: true })

const props = withDefaults(
  defineProps<{
    window: LedgerWindow
    /** The presets this screen offers, in the bar's order. */
    presets?: readonly PeriodPreset[]
    /** One control per row, as in the phone's filter sheet. */
    stacked?: boolean
  }>(),
  { presets: () => ['l3', 'l12', 'year', 'quarter', 'custom', 'all'], stacked: false },
)

const rangeText = computed(() => periodInWords(period.value, props.window))
const presetChoices = computed(() => props.presets.map((preset) => ({ value: preset, label: words.presets[preset] })))

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

const monthItems = computed(() => ledgerMonths(props.window).map((month): { label: string; value: string } => ({ label: monthLabel(month), value: month })))
const selectedMonth = computed({
  get: () => (period.value.preset === 'month' ? period.value.month : '') as string,
  set: (text: string) => {
    const month = parseMonthKey(text)
    if (period.value.preset === 'month' && month !== null) {
      period.value = { preset: 'month', month }
    }
  },
})

const customRange = computed(() => (period.value.preset === 'custom' ? period.value.range : null))

function setCustomEnd(end: 'from' | 'to', text: string): void {
  const date = parseCivilDate(text)
  const range = customRange.value
  if (date === null || range === null) {
    return
  }
  period.value = { preset: 'custom', range: withRangeEnd(range, end, date) }
}

function choosePreset(preset: PeriodPreset): void {
  if (preset !== period.value.preset) {
    period.value = periodWithPreset(period.value, preset, props.window)
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-x-3 gap-y-2" :class="stacked ? 'flex-col items-start' : 'items-center'" data-testid="period-bar">
    <ChoiceButtons :model-value="period.preset" :options="presetChoices" :label="words.period" @update:model-value="choosePreset" />

    <div v-if="period.preset === 'year' || period.preset === 'quarter'" class="flex items-center gap-2">
      <USelect v-model="selectedYear" :items="yearItems" size="sm" :aria-label="words.year" class="w-24" />
      <USelect v-if="period.preset === 'quarter'" v-model="selectedQuarter" :items="QUARTERS" size="sm" :aria-label="words.quarter" class="w-20" />
    </div>

    <USelect v-if="period.preset === 'month'" v-model="selectedMonth" :items="monthItems" size="sm" :aria-label="words.month" class="w-40" />

    <div v-if="customRange" class="flex flex-wrap items-center gap-2">
      <DayField size="sm" :aria-label="words.from" :model-value="customRange.from" class="w-40" @change="setCustomEnd('from', $event)" />
      <span class="type-caption">{{ words.until }}</span>
      <DayField size="sm" :aria-label="words.to" :model-value="customRange.to" class="w-40" @change="setCustomEnd('to', $event)" />
    </div>

    <p v-if="!customRange" class="figure type-body" data-testid="period-range">{{ rangeText }}</p>
  </div>
</template>
