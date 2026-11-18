<script setup lang="ts" generic="Problem extends WorkbookProblem">
import type { WorkbookProblem } from '../../workbook/domain/workbook'

defineProps<{
  problems: readonly Problem[]
}>()

defineSlots<{
  /** What the line's first column says, the file tab it came from unless the caller names a status. */
  tag?: (props: { problem: Problem }) => unknown
  action?: (props: { problem: Problem }) => unknown
}>()
</script>

<template>
  <ul class="max-h-56 divide-y divide-default overflow-y-auto rounded-control border border-default text-sm">
    <li v-for="(problem, index) in problems" :key="index" class="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <span class="shrink-0 type-caption sm:w-28"
        ><slot name="tag" :problem="problem"
          ><span class="identifier">{{ problem.tab }}</span></slot
        ></span
      >
      <span class="min-w-0 flex-1 text-toned"
        ><span class="text-highlighted">{{ problem.label }}</span
        >: {{ problem.reason }}</span
      >
      <slot name="action" :problem="problem" />
    </li>
  </ul>
</template>
