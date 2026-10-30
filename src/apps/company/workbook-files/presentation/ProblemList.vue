<script setup lang="ts">
import type { WorkbookProblem } from '../../workbook/domain/workbook'

defineProps<{
  problems: readonly WorkbookProblem[]
}>()
</script>

<template>
  <ul class="max-h-56 divide-y divide-default overflow-y-auto rounded-control border border-default text-sm">
    <li v-for="(problem, index) in problems" :key="index" class="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
      <span class="figure shrink-0 text-xs text-muted sm:w-28">{{ problem.tab }}</span>
      <span class="min-w-0 flex-1 text-toned"
        ><span class="text-highlighted">{{ problem.label }}</span
        >: {{ problem.reason }}</span
      >
      <slot name="action" :problem="problem" />
    </li>
  </ul>
</template>
