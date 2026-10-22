<script setup lang="ts">
import type { WorkbookProblem } from '../../workbook/domain/workbook'

defineProps<{
  problems: readonly WorkbookProblem[]
}>()
</script>

<template>
  <ul class="problem-list max-h-56 overflow-y-auto rounded-control border border-default text-sm">
    <li v-for="(problem, index) in problems" :key="index" class="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
      <span class="figure shrink-0 text-xs text-muted sm:w-28">{{ problem.tab }}</span>
      <span class="min-w-0 text-toned"><span class="text-highlighted">{{ problem.label }}</span>: {{ problem.reason }}</span>
    </li>
  </ul>
</template>

<style scoped>
.problem-list > li + li {
  border-top: 1px solid var(--border-default);
}
</style>
