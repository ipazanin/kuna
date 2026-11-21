<script setup lang="ts">
import { ref } from 'vue'

import GallerySection from './GallerySection.vue'
import { civilDate } from '../../shared/calendar/civilDate'
import { anchorWindow } from '../../shared/calendar/ledgerWindow'
import { monthKey } from '../../shared/calendar/monthKey'
import type { Period } from '../../shared/calendar/period'
import AppCard from '../../shared/ui/AppCard.vue'
import PeriodBar from '../../shared/ui/PeriodBar.vue'

const SAMPLE_WINDOW = anchorWindow(civilDate(2024, 3, 1), civilDate(2026, 10, 14))

const lastTwelve = ref<Period>({ preset: 'l12' })
const oneMonth = ref<Period>({ preset: 'month', month: monthKey(2026, 9) })
const stacked = ref<Period>({ preset: 'custom', range: { from: civilDate(2026, 9, 3), to: civilDate(2026, 10, 14) } })
</script>

<template>
  <GallerySection
    id="period-bar"
    title="PeriodBar"
    description="A span picker: the presets, a year, quarter or month select, two days of your own, and the days the period covers in words. Stacked puts one control per row, as in a phone's filter sheet."
  >
    <AppCard as="div" class="flex flex-col gap-4 p-4">
      <h3 class="type-label">The default presets</h3>
      <PeriodBar v-model:period="lastTwelve" :window="SAMPLE_WINDOW" />
      <h3 class="type-label">With a month</h3>
      <PeriodBar v-model:period="oneMonth" :window="SAMPLE_WINDOW" :presets="['month', 'l3', 'l12', 'year', 'custom', 'all']" />
      <h3 class="type-label">Stacked, on days of your own</h3>
      <PeriodBar v-model:period="stacked" :window="SAMPLE_WINDOW" :presets="['month', 'l12', 'year', 'custom']" stacked />
      <p class="figure type-caption" aria-live="polite">Picked: {{ JSON.stringify([lastTwelve, oneMonth, stacked]) }}</p>
    </AppCard>
  </GallerySection>
</template>
