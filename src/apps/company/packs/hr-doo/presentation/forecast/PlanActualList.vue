<script setup lang="ts">
import { ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import type { PlanActualView } from './forecastView'

/** Each planned line against the ledger, with plan, actual and the difference, opening on its months. */
defineProps<{
  lines: readonly PlanActualView[]
}>()

const open = ref(new Set<string>())

function toggle(key: string): void {
  const next = new Set(open.value)
  if (!next.delete(key)) next.add(key)
  open.value = next
}
</script>

<template>
  <ul class="flex flex-col" data-testid="plan-actual">
    <li v-for="line in lines" :key="line.key" class="compare-line">
      <button type="button" class="compare-toggle" :aria-expanded="open.has(line.key)" :aria-controls="`plan-actual-${line.key}`" @click="toggle(line.key)">
        <UIcon name="i-lucide-chevron-right" class="compare-chevron size-4 shrink-0 text-muted" :class="{ 'is-open': open.has(line.key) }" aria-hidden="true" />
        <span class="min-w-0 flex-1 text-start">
          <span class="block text-sm text-toned">{{ line.label }}</span>
          <span class="block text-xs text-muted">{{ line.verdict }}</span>
        </span>
        <span class="figures">
          <span><span class="figure-label">Plan</span><MoneyText :cents="line.plan" class="text-sm text-toned" /></span>
          <span><span class="figure-label">Actual</span><MoneyText :cents="line.actual" class="text-sm text-toned" /></span>
          <span><span class="figure-label">Difference</span><MoneyText :cents="line.difference" sign="always" class="text-sm font-medium text-highlighted" /></span>
        </span>
      </button>
      <ul v-if="open.has(line.key)" :id="`plan-actual-${line.key}`" class="months">
        <li v-for="month in line.months" :key="month.key" class="month-row">
          <span class="month-name text-xs text-muted">{{ month.month }}</span>
          <span class="figures">
            <MoneyText :cents="month.plan" class="text-xs text-muted" />
            <MoneyText :cents="month.actual" class="text-xs text-muted" />
            <MoneyText :cents="month.difference" sign="always" class="text-xs text-toned" />
          </span>
        </li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.compare-line + .compare-line {
  border-top: 1px solid var(--border-default);
}

.compare-toggle {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  padding-block: 0.5rem;
  border-radius: var(--radius-control);
}

.compare-toggle:hover {
  background: var(--surface-elevated);
}

.compare-chevron {
  transition: transform 150ms ease;
}

.compare-chevron.is-open {
  transform: rotate(90deg);
}

.figures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-inline-start: auto;
  text-align: end;
}

.compare-toggle .figures {
  flex: 1 1 18rem;
}

.figures > span {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.figure-label {
  font-size: 0.6875rem;
  color: var(--ui-text-muted);
}

.months {
  display: flex;
  flex-direction: column;
  padding: 0 0 0.5rem 1.75rem;
}

.month-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  padding-block: 0.25rem;
}

.month-name {
  flex: 1 1 0%;
  min-width: 0;
}

.month-row .figures {
  flex: 1 1 18rem;
}
</style>
