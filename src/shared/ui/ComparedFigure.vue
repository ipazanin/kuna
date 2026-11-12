<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { ComparedCell } from './ScenarioComparison.vue'
import { TONE_ICONS } from './toneText'
import { words } from './words'

/** One figure of a scenario comparison: the figure, a tick where it is the best, and under it the second figure, the difference to the base and the warning. */
defineProps<{
  cell: ComparedCell
  /** A line the others add up to, whose figure is set in strong ink. */
  total: boolean
  /** What a screen reader hears beside a ticked figure, such as "the best". */
  bestNote: string
}>()
</script>

<template>
  <span class="flex flex-col items-end">
    <span class="inline-flex items-center gap-1" :class="cell.best || total ? 'font-medium text-highlighted' : 'text-toned'">
      <UIcon v-if="cell.best" name="i-lucide-circle-check" class="size-3.5 text-success" aria-hidden="true" />
      <span v-if="cell.best" class="sr-only">{{ bestNote }}</span>
      <UIcon v-if="cell.warning" :name="TONE_ICONS.warning" class="size-3.5 text-warning" aria-hidden="true" />
      <span v-if="cell.warning" class="sr-only">{{ words.warning }}</span>
      <span class="figure">{{ cell.text }}</span>
    </span>
    <span v-if="cell.second" class="figure type-caption">{{ cell.second }}</span>
    <span v-if="cell.difference !== null" class="figure type-caption">{{ cell.difference }}</span>
    <span v-if="cell.warning" class="type-caption">{{ cell.warning }}</span>
  </span>
</template>
