<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

export interface KontoGroupView {
  readonly key: string
  readonly konto: readonly { readonly line: string; readonly label: string; readonly cents: number }[]
  readonly categories: readonly { readonly key: string; readonly label: string; readonly cents: number; readonly to: RouteLocationRaw | null }[]
  readonly accountant: number
  readonly ours: number
  readonly difference: number
}
</script>

<script setup lang="ts">
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { words as packWords } from '../words'
import { words } from './words'

/**
 * Each konto group beside our accrual figure for its categories. A category slip, such as a cost
 * filed under the wrong category, shows as two groups that differ by the same amount either way.
 */
defineProps<{
  groups: readonly KontoGroupView[]
  unnamed: readonly { readonly line: string; readonly label: string; readonly cents: number }[]
}>()
</script>

<template>
  <ul class="flex flex-col" data-testid="konto-table">
    <li class="konto-head" aria-hidden="true">
      <span>{{ words.konto.asBooked }}</span>
      <span>{{ words.konto.ourCategories }}</span>
      <span class="text-end">{{ words.konto.difference }}</span>
    </li>
    <li v-for="group in groups" :key="group.key" class="konto-group">
      <dl class="konto-side">
        <div v-for="konto in group.konto" :key="konto.line" class="konto-line">
          <dt class="min-w-0">
            <span class="identifier text-toned">{{ konto.line }}</span> <span class="text-toned">{{ konto.label }}</span>
          </dt>
          <dd><MoneyText :cents="konto.cents" /></dd>
        </div>
      </dl>
      <dl class="konto-side">
        <div v-for="category in group.categories" :key="category.key" class="konto-line">
          <dt class="min-w-0 text-toned">
            <DrillLink :to="category.to" :label="packWords.figure.openRows(category.label)">{{ category.label }}</DrillLink>
          </dt>
          <dd><MoneyText :cents="category.cents" /></dd>
        </div>
      </dl>
      <p class="konto-difference" :class="group.difference === 0 ? 'text-success' : 'text-warning'">
        <span class="text-xs text-muted sm:hidden">{{ words.konto.differenceLabel }}</span
        ><MoneyText :cents="group.difference" sign="always" />
      </p>
    </li>
    <li v-if="unnamed.length > 0" class="konto-group">
      <dl class="konto-side">
        <div v-for="konto in unnamed" :key="konto.line" class="konto-line">
          <dt class="min-w-0">
            <span class="identifier text-toned">{{ konto.line }}</span> <span class="text-toned">{{ konto.label }}</span>
          </dt>
          <dd><MoneyText :cents="konto.cents" /></dd>
        </div>
      </dl>
      <p class="text-sm text-muted">{{ words.konto.unnamedBefore }}<span class="identifier">categories</span>{{ words.konto.unnamedAfter }}</p>
    </li>
  </ul>
</template>

<style scoped>
.konto-head,
.konto-group {
  display: grid;
  gap: 0.5rem 1.5rem;
  grid-template-columns: minmax(0, 1fr);
  padding-block: 0.625rem;
}

.konto-head {
  display: none;
  border-bottom: 1px solid var(--border-default);
  padding-block: 0 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
}

.konto-group + .konto-group {
  border-top: 1px solid var(--border-default);
}

.konto-side {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.konto-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.konto-difference {
  font-size: 0.875rem;
}

@media (min-width: 640px) {
  .konto-head,
  .konto-group {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 7rem;
  }

  .konto-head {
    display: grid;
  }

  .konto-difference {
    text-align: end;
  }
}
</style>
