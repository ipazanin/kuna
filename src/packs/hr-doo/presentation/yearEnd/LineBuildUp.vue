<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/** One step of a figure, an adjustment or a rule, ready to open what is behind it. */
export interface BuildUpStep {
  readonly key: string
  readonly label: string
  /** Null for a step with no amount of its own, such as a rule. */
  readonly cents: number | null
  readonly to: RouteLocationRaw | null
  /** 1 for a step inside the one above it. */
  readonly depth: 0 | 1
}

export interface RuleChip {
  readonly id: string
  readonly title: string
  readonly to: RouteLocationRaw
}
</script>

<script setup lang="ts">
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** How our figure for a line is built, the cash view's figure, the adjustments between them and the rules behind them. */
defineProps<{
  ours: readonly BuildUpStep[]
  cash: readonly BuildUpStep[]
  explainedBy: readonly BuildUpStep[]
  rules: readonly RuleChip[]
}>()
</script>

<template>
  <div class="build-up" data-testid="line-build-up">
    <section v-if="ours.length > 0" aria-label="Ours, step by step">
      <h4 class="build-up-title">Ours, step by step</h4>
      <ul class="step-list">
        <li v-for="step in ours" :key="step.key" class="step-row" :class="{ 'is-nested': step.depth === 1 }">
          <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="step-label">{{ step.label }}</DrillLink>
          <MoneyText v-if="step.cents !== null" :cents="step.cents" class="text-toned" />
        </li>
      </ul>
    </section>
    <section v-if="cash.length > 0" aria-label="The cash view">
      <h4 class="build-up-title">The cash view</h4>
      <ul class="step-list">
        <li v-for="step in cash" :key="step.key" class="step-row" :class="{ 'is-nested': step.depth === 1 }">
          <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="step-label">{{ step.label }}</DrillLink>
          <MoneyText v-if="step.cents !== null" :cents="step.cents" class="text-toned" />
        </li>
      </ul>
    </section>
    <section v-if="explainedBy.length > 0" aria-label="Explained by">
      <h4 class="build-up-title">Explained by</h4>
      <ul class="step-list">
        <li v-for="step in explainedBy" :key="step.key" class="step-row">
          <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="step-label">{{ step.label }}</DrillLink>
          <MoneyText v-if="step.cents !== null" :cents="step.cents" sign="always" class="text-toned" />
        </li>
      </ul>
    </section>
    <section v-if="rules.length > 0" aria-label="Rules">
      <h4 class="build-up-title">Rules</h4>
      <ul class="flex flex-wrap gap-x-4 gap-y-1">
        <li v-for="rule in rules" :key="rule.id">
          <DrillLink :to="rule.to" :label="`${rule.title}, open the rule`" class="text-sm text-highlighted">{{ rule.title }}</DrillLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.build-up {
  display: grid;
  gap: 1rem 2rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}

.build-up-title {
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
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
  font-size: 0.875rem;
}

.step-row.is-nested {
  padding-inline-start: 0.875rem;
  font-size: 0.8125rem;
}

.step-label {
  min-width: 0;
  color: var(--ink);
}
</style>
