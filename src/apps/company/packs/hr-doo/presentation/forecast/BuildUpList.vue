<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { ShownValue } from '../yearEnd/ComparisonTable.vue'
import type { BuildUpStep, RuleChip } from '../yearEnd/LineBuildUp.vue'

/** One line of a build-up, which opens on the steps behind it and the rules it rests on. */
export interface BuildUpLine {
  readonly key: string
  readonly label: string
  /** What the figure rests on, such as "Jan to Sep from the ledger, Oct averaged". */
  readonly caption: string | null
  readonly value: ShownValue
  readonly to: RouteLocationRaw | null
  /** A total closes the lines above it. */
  readonly total: boolean
  readonly steps: readonly BuildUpStep[]
  readonly rules: readonly RuleChip[]
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'

/** A list of figures that add up, each opening on its steps, their rows and the rules behind it. */
const props = defineProps<{
  lines: readonly BuildUpLine[]
  testId: string
}>()

const open = ref(new Set<string>())

function toggle(key: string): void {
  const next = new Set(open.value)
  if (!next.delete(key)) {
    next.add(key)
  }
  open.value = next
}

function opens(line: BuildUpLine): boolean {
  return line.steps.length > 0 || line.rules.length > 0
}

function domId(key: string): string {
  return `${props.testId}-${key}`
}
</script>

<template>
  <ul class="flex flex-col" :data-testid="testId">
    <li v-for="line in lines" :key="line.key" class="line-row" :class="{ 'is-total': line.total }">
      <div class="line-head">
        <button v-if="opens(line)" type="button" class="line-toggle" :aria-expanded="open.has(line.key)" :aria-controls="domId(line.key)" data-testid="build-up-toggle" @click="toggle(line.key)">
          <UIcon name="i-lucide-chevron-right" class="line-chevron size-4 shrink-0 text-dimmed" :class="{ 'is-open': open.has(line.key) }" aria-hidden="true" />
          <span class="min-w-0">
            <span class="block text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'">{{ line.label }}</span>
            <span v-if="line.caption" class="block text-xs text-muted">{{ line.caption }}</span>
          </span>
        </button>
        <div v-else class="line-plain">
          <span class="block text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'">{{ line.label }}</span>
          <span v-if="line.caption" class="block text-xs text-muted">{{ line.caption }}</span>
        </div>
        <DrillLink :to="line.to" :label="`${line.label}, open the rows`" class="line-amount">
          <MoneyText v-if="'cents' in line.value" :cents="line.value.cents" class="text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'" />
          <span v-else class="figure text-sm text-toned">{{ line.value.text }}</span>
        </DrillLink>
      </div>
      <div v-if="open.has(line.key)" :id="domId(line.key)" class="line-detail" data-testid="build-up-detail">
        <ul v-if="line.steps.length > 0" class="step-list" aria-label="Step by step">
          <li v-for="step in line.steps" :key="step.key" class="step-row" :class="{ 'is-nested': step.depth === 1 }">
            <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="step-label">{{ step.label }}</DrillLink>
            <MoneyText v-if="step.cents !== null" :cents="step.cents" class="text-toned" />
          </li>
        </ul>
        <ul v-if="line.rules.length > 0" class="flex flex-wrap gap-x-4 gap-y-1" aria-label="Rules">
          <li v-for="rule in line.rules" :key="rule.id">
            <DrillLink :to="rule.to" :label="`${rule.title}, open the rule`" class="text-xs text-highlighted">{{ rule.title }}</DrillLink>
          </li>
        </ul>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.line-row + .line-row {
  border-top: 1px solid var(--border-default);
}

.line-row.is-total {
  border-top-color: var(--border-strong);
}

.line-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.line-toggle,
.line-plain {
  display: flex;
  min-width: 0;
  min-height: 2.75rem;
  flex: 1;
  align-items: center;
  gap: 0.375rem;
  padding-block: 0.375rem;
  text-align: start;
}

.line-plain {
  padding-inline-start: 1.375rem;
}

.line-toggle {
  border-radius: var(--radius-control);
}

.line-toggle:hover .line-chevron {
  color: var(--ink);
}

.line-chevron {
  transition: transform 120ms ease;
}

.line-chevron.is-open {
  transform: rotate(90deg);
}

.line-amount {
  flex-shrink: 0;
}

.line-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.25rem 0 0.75rem 1.375rem;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.step-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.step-row.is-nested {
  padding-inline-start: 0.875rem;
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.step-label {
  min-width: 0;
  color: var(--ink);
}

.step-row.is-nested .step-label {
  color: var(--ink-muted);
}
</style>
