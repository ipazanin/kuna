<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { LineStatus } from '../../domain/yearEnd/yearEndComparison'
import type { RuleChip } from './LineBuildUp.vue'

export interface BridgeStepView {
  readonly key: string
  readonly label: string
  readonly cents: number
  readonly to: RouteLocationRaw | null
  /** Null for a total, which is no adjustment. */
  readonly kind: LineStatus | null
  readonly rules: readonly RuleChip[]
}
</script>

<script setup lang="ts">
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import StatusBadge from './StatusBadge.vue'
import { words as packWords } from '../words'
import { words } from './words'

/** The bridge as a list: each adjustment in words, with its amount, its rows and its rules. */
defineProps<{
  steps: readonly BridgeStepView[]
}>()

/** A step names this many of its rules and counts the rest. */
const NAMED = 2
</script>

<template>
  <ol class="bridge-list" :style="{ '--bridge-rows': Math.ceil(steps.length / 2) }" data-testid="bridge-steps">
    <li v-for="step in steps" :key="step.key" class="bridge-row" :class="{ 'is-total': step.kind === null }">
      <div class="flex items-baseline justify-between gap-3">
        <p class="min-w-0 text-sm" :class="step.kind === null ? 'font-medium text-highlighted' : 'text-toned'">{{ step.label }}</p>
        <DrillLink :to="step.to" :label="packWords.figure.openRows(step.label)" class="shrink-0">
          <MoneyText :cents="step.cents" :sign="step.kind === null ? 'negative' : 'always'" class="text-sm" :class="step.kind === null ? 'font-medium text-highlighted' : ''" />
        </DrillLink>
      </div>
      <div v-if="step.kind !== null" class="mt-1 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
        <StatusBadge :status="step.kind" />
        <ul v-if="step.rules.length > 0" class="flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-3">
          <li v-for="rule in step.rules.slice(0, NAMED)" :key="rule.id">
            <DrillLink :to="rule.to" :label="packWords.figure.openRule(rule.title)" class="text-xs text-highlighted">{{ rule.title }}</DrillLink>
          </li>
          <li v-if="step.rules.length > NAMED" class="text-xs text-muted">{{ words.steps.moreRules(step.rules.length - NAMED) }}</li>
        </ul>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.bridge-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: 2.5rem;
}

@media (min-width: 1024px) {
  .bridge-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: column;
    grid-template-rows: repeat(var(--bridge-rows), auto);
  }
}

.bridge-row {
  padding-block: 0.5rem;
}

.bridge-row + .bridge-row {
  border-top: 1px solid var(--border-default);
}

.bridge-row.is-total + .bridge-row,
.bridge-row + .bridge-row.is-total {
  border-top-color: var(--border-strong);
}
</style>
