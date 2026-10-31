<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import type { FigureDetail } from '../tracedFigureView'
import type { ProblemView } from './salariesView'
import { words } from './words'

/** What the app and the bank do not agree on, or what is missing, each with what to open to resolve it. */
defineProps<{
  problems: readonly ProblemView[]
  /** The payday, such as "Sep 2026". */
  label: string
}>()

defineEmits<{
  open: [detail: FigureDetail]
}>()

const FACT = { hash: '#employee-rows' }
</script>

<template>
  <AppCard id="salary-problems" :title="words.problemList.title" :subtitle="words.problemList.subtitle(label)" data-testid="salaries-problems">
    <p v-if="problems.length === 0" class="flex items-center gap-2 px-4 pt-1 pb-4 text-sm text-toned sm:px-5">
      <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 text-success" aria-hidden="true" />
      {{ words.problemList.allAgree }}
    </p>
    <ul v-else class="flex flex-col px-4 pb-3 sm:px-5">
      <li v-for="problem in problems" :key="problem.key" class="problem-row" data-testid="salaries-problem">
        <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <p class="text-sm text-toned">{{ problem.text }}</p>
          <div v-if="problem.detail || problem.rows || problem.fact" class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <button v-if="problem.detail" type="button" class="problem-action text-highlighted" @click="$emit('open', problem.detail)">{{ words.problemList.howWorkedOut }}</button>
            <DrillLink v-if="problem.rows" :to="problem.rows" class="text-highlighted">{{ words.problemList.viewRows }}</DrillLink>
            <DrillLink v-if="problem.fact" :to="FACT" class="text-highlighted">{{ words.problemList.openEmployees }}</DrillLink>
          </div>
        </div>
      </li>
    </ul>
  </AppCard>
</template>

<style scoped>
.problem-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding-block: 0.625rem;
  border-bottom: 1px solid var(--border-default);
}

.problem-row:last-child {
  border-bottom: 0;
}

.problem-action {
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.problem-action:hover {
  text-decoration-color: var(--accent);
}

.problem-action:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
