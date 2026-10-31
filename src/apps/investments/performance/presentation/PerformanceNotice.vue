<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import type { BenchmarkState } from '../domain/benchmark'
import type { HeldBack, Performance } from '../domain/portfolioPerformance'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'

/**
 * What the period's figures could not use as they are: a benchmark with no close, a late one or none for the period's
 * first day, days a holding had no price, a day worth less than nothing, and closes that were late by then.
 */
const props = defineProps<{
  performance: Performance
  benchmark: BenchmarkState
}>()

function heldBackNames(heldBack: HeldBack): string {
  return listInWords([...heldBack.instruments.map((instrument) => instrument.name), ...heldBack.currencies])
}

const figures = computed(() => (props.performance.kind === 'figures' ? props.performance : null))

const problems = computed(() => {
  const benchmark = props.benchmark
  const shown = figures.value
  const heldBack = shown === null ? '' : heldBackNames(shown.heldBack)
  return [
    ...(benchmark.kind === 'no-closes' ? [words.notice.noCloses(benchmark.instrument.name)] : []),
    ...(benchmark.kind === 'priced' && benchmark.late ? [words.notice.lateBenchmark(benchmark.instrument.name, dayLabel(benchmark.close.date))] : []),
    ...(shown === null || benchmark.kind !== 'priced' || shown.benchmark !== null ? [] : [words.notice.benchmarkLater(benchmark.instrument.name, dayLabel(shown.from))]),
    ...(shown === null || heldBack === '' ? [] : [words.notice.heldBack(heldBack, dayLabel(shown.from), dayLabel(shown.to))]),
    ...(shown === null || shown.belowZeroOn === null ? [] : [words.notice.belowZero(dayLabel(shown.belowZeroOn))]),
  ]
})

const lateCloses = computed(() => {
  const late = figures.value?.lateCloses ?? []
  return late.length === 0 ? [] : [plural(words.notice.lateCloses(late.length, listInWords(late.map((instrument) => instrument.name))), late.length)]
})
</script>

<template>
  <UAlert
    v-if="problems.length + lateCloses.length > 0"
    :icon="problems.length > 0 ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
    :color="problems.length > 0 ? 'warning' : 'neutral'"
    variant="subtle"
    :title="problems.length > 0 ? words.notice.title : words.notice.aboutTitle"
    data-testid="performance-notice"
  >
    <template #description>
      <ul class="flex flex-col gap-0.5">
        <li v-for="line in [...problems, ...lateCloses]" :key="line">{{ line }}</li>
      </ul>
    </template>
  </UAlert>
</template>
