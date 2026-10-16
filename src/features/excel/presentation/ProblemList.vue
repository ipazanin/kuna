<script setup lang="ts">
import type { WorkbookProblem } from '../../workbook/domain/workbook'

defineProps<{
  problems: readonly WorkbookProblem[]
}>()
</script>

<template>
  <ul class="problem-list max-h-56 overflow-y-auto rounded-control border border-default text-sm">
    <li v-for="(problem, index) in problems" :key="index" class="flex gap-3 px-3 py-2">
      <span class="figure w-28 shrink-0 text-xs text-muted">{{ problem.tab }}, row {{ problem.sheetRow }}</span>
      <span class="min-w-0 text-toned">{{ problem.reason }}</span>
    </li>
  </ul>
</template>

<style scoped>
.problem-list > li + li {
  border-top: 1px solid var(--border-default);
}
</style>
