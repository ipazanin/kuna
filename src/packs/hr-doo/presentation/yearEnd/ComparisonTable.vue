<script lang="ts">
import type { RouteLocationRaw } from 'vue-router'

import type { LineStatus } from '../../domain/yearEnd/yearEndComparison'
import type { BuildUpStep, RuleChip } from './LineBuildUp.vue'

/** An amount in cents, or a rate or a count written out. */
export type ShownValue = { readonly cents: number } | { readonly text: string }

export interface ComparisonRow {
  readonly key: string
  readonly label: string
  /** The label as the accountant's package prints it. */
  readonly printed: string
  readonly accountant: ShownValue
  /** Null when the app does not compute the line. */
  readonly ours: ShownValue | null
  readonly oursTo: RouteLocationRaw | null
  /** Null where the cash view has no figure for the line. */
  readonly cash: number | null
  readonly cashTo: RouteLocationRaw | null
  readonly difference: number | null
  readonly residual: number | null
  readonly status: LineStatus
  readonly explainedBy: readonly BuildUpStep[]
  readonly oursSteps: readonly BuildUpStep[]
  readonly cashSteps: readonly BuildUpStep[]
  readonly rules: readonly RuleChip[]
}
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useMediaQuery } from '../../../../shared/layout/viewport'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import LineBuildUp from './LineBuildUp.vue'
import StatusBadge from './StatusBadge.vue'

/**
 * The accountant's lines of one statement beside ours: a table on a wide screen, one card per line
 * below the xl breakpoint, where eight columns do not fit. Each line opens on how ours is built.
 */
const props = defineProps<{
  rows: readonly ComparisonRow[]
  testId: string
}>()

/** A statement the cash view has no figure for, such as the PD return, leaves out its two cash columns. */
const hasCash = computed(() => props.rows.some((row) => row.cash !== null))

const narrow = useMediaQuery('(max-width: 1279px)')
const open = ref(new Set<string>())

/** The table cell names this many adjustments, and the opened line all of them. */
const NAMED = 2

function toggle(key: string): void {
  const next = new Set(open.value)
  if (!next.delete(key)) {
    next.add(key)
  }
  open.value = next
}

function isMoney(value: ShownValue): value is { readonly cents: number } {
  return 'cents' in value
}
</script>

<template>
  <ul v-if="narrow" class="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2" :data-testid="testId">
    <li v-for="row in rows" :key="row.key" class="flex min-w-0 flex-col rounded-control border border-default px-3 py-2.5" :data-status="row.status">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">{{ row.label }}</p>
          <p class="truncate text-xs text-muted">{{ row.printed }}</p>
        </div>
        <StatusBadge :status="row.status" />
      </div>
      <dl class="line-cells mt-2">
        <div>
          <dt>Accountant</dt>
          <dd><MoneyText v-if="isMoney(row.accountant)" :cents="row.accountant.cents" /><template v-else>{{ row.accountant.text }}</template></dd>
        </div>
        <div>
          <dt>Ours, accrual</dt>
          <dd>
            <template v-if="row.ours === null"><span class="text-dimmed">Not computed</span></template>
            <DrillLink v-else :to="row.oursTo" :label="`${row.label}, ours, open the rows`">
              <MoneyText v-if="isMoney(row.ours)" :cents="row.ours.cents" /><template v-else>{{ row.ours.text }}</template>
            </DrillLink>
          </dd>
        </div>
        <div v-if="hasCash">
          <dt>Ours, cash</dt>
          <dd>
            <DrillLink v-if="row.cash !== null" :to="row.cashTo" :label="`${row.label}, cash, open the rows`"><MoneyText :cents="row.cash" /></DrillLink>
            <span v-else class="text-dimmed">–</span>
          </dd>
        </div>
        <div v-if="hasCash">
          <dt>Difference</dt>
          <dd><MoneyText v-if="row.difference !== null" :cents="row.difference" sign="always" /><span v-else class="text-dimmed">–</span></dd>
        </div>
        <div>
          <dt>Residual</dt>
          <dd :class="row.residual === 0 ? 'text-positive' : row.residual === null ? '' : 'text-[var(--tone-warning)]'">
            <MoneyText v-if="row.residual !== null" :cents="row.residual" sign="always" /><span v-else class="text-dimmed">–</span>
          </dd>
        </div>
      </dl>
      <p v-if="row.explainedBy.length > 0" class="mt-2 text-xs text-muted">
        Explained by {{ row.explainedBy.slice(0, NAMED).map((step) => step.label).join(', ')
        }}<template v-if="row.explainedBy.length > NAMED"> and {{ row.explainedBy.length - NAMED }} more</template>
      </p>
      <button
        type="button"
        class="line-toggle mt-auto"
        :aria-expanded="open.has(row.key)"
        :aria-controls="`${testId}-${row.key}`"
        data-testid="comparison-toggle"
        @click="toggle(row.key)"
      >
        <UIcon name="i-lucide-chevron-right" class="line-chevron size-4 shrink-0 text-dimmed" :class="{ 'is-open': open.has(row.key) }" aria-hidden="true" />
        <span>{{ open.has(row.key) ? 'Hide how ours is built' : 'How ours is built' }}</span>
      </button>
      <div v-if="open.has(row.key)" :id="`${testId}-${row.key}`" class="border-t border-default pt-3 pb-1">
        <LineBuildUp :ours="row.oursSteps" :cash="row.cashSteps" :explained-by="row.explainedBy" :rules="row.rules" />
      </div>
    </li>
  </ul>

  <div v-else class="overflow-x-auto">
    <table class="data-table comparison-table w-full text-sm" :data-testid="testId">
      <thead>
        <tr>
          <th scope="col" class="text-start">Line</th>
          <th scope="col" class="text-end">Accountant</th>
          <th scope="col" class="text-end">Ours, accrual</th>
          <template v-if="hasCash">
            <th scope="col" class="text-end">Ours, cash</th>
            <th scope="col" class="text-end">Difference</th>
          </template>
          <th scope="col" class="text-start">Explained by</th>
          <th scope="col" class="text-end">Residual</th>
          <th scope="col" class="text-start">Status</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.key">
          <tr :data-status="row.status">
            <th scope="row" class="text-start font-normal">
              <button
                type="button"
                class="row-toggle"
                :aria-expanded="open.has(row.key)"
                :aria-controls="`${testId}-${row.key}`"
                :aria-label="`${row.label}, how ours is built`"
                data-testid="comparison-toggle"
                @click="toggle(row.key)"
              >
                <UIcon name="i-lucide-chevron-right" class="line-chevron size-4 shrink-0 text-dimmed" :class="{ 'is-open': open.has(row.key) }" aria-hidden="true" />
                <span class="min-w-0">
                  <span class="block text-highlighted">{{ row.label }}</span>
                  <span class="block truncate text-xs text-muted">{{ row.printed }}</span>
                </span>
              </button>
            </th>
            <td class="text-end"><MoneyText v-if="isMoney(row.accountant)" :cents="row.accountant.cents" /><span v-else class="figure">{{ row.accountant.text }}</span></td>
            <td class="text-end">
              <span v-if="row.ours === null" class="text-dimmed">Not computed</span>
              <DrillLink v-else :to="row.oursTo" :label="`${row.label}, ours, open the rows`">
                <MoneyText v-if="isMoney(row.ours)" :cents="row.ours.cents" /><span v-else class="figure">{{ row.ours.text }}</span>
              </DrillLink>
            </td>
            <template v-if="hasCash">
              <td class="text-end">
                <DrillLink v-if="row.cash !== null" :to="row.cashTo" :label="`${row.label}, cash, open the rows`"><MoneyText :cents="row.cash" class="text-toned" /></DrillLink>
                <span v-else class="text-dimmed">–</span>
              </td>
              <td class="text-end"><MoneyText v-if="row.difference !== null" :cents="row.difference" sign="always" class="text-toned" /><span v-else class="text-dimmed">–</span></td>
            </template>
            <td class="explained-cell">
              <ul v-if="row.explainedBy.length > 0" class="flex flex-col">
                <li v-for="step in row.explainedBy.slice(0, NAMED)" :key="step.key">
                  <DrillLink :to="step.to" :label="`${step.label}, open the rows`" class="text-toned">{{ step.label }}</DrillLink>
                </li>
                <li v-if="row.explainedBy.length > NAMED" class="text-xs text-muted">and {{ row.explainedBy.length - NAMED }} more</li>
              </ul>
              <span v-else class="text-dimmed">–</span>
            </td>
            <td class="text-end" :class="row.residual === 0 ? 'text-positive' : row.residual === null ? '' : 'text-[var(--tone-warning)]'">
              <MoneyText v-if="row.residual !== null" :cents="row.residual" sign="always" /><span v-else class="text-dimmed">–</span>
            </td>
            <td><StatusBadge :status="row.status" /></td>
          </tr>
          <tr v-if="open.has(row.key)" :id="`${testId}-${row.key}`" class="build-up-row">
            <td :colspan="hasCash ? 8 : 6">
              <LineBuildUp :ours="row.oursSteps" :cash="row.cashSteps" :explained-by="row.explainedBy" :rules="row.rules" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.comparison-table th,
.comparison-table td {
  padding-inline: 0.5rem;
  vertical-align: top;
}

.comparison-table thead th {
  white-space: normal;
  vertical-align: bottom;
}

.explained-cell {
  min-width: 10rem;
}

.build-up-row td {
  padding-block: 0.75rem 1rem;
  padding-inline-start: 2rem;
  background: var(--surface-elevated);
}

.row-toggle,
.line-toggle {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0.375rem;
  border-radius: var(--radius-control);
  text-align: start;
}

.line-toggle {
  min-height: 2.75rem;
  align-items: center;
  font-size: 0.875rem;
  color: var(--ink);
}

.row-toggle .line-chevron {
  margin-top: 0.125rem;
}

.row-toggle:hover .line-chevron,
.line-toggle:hover .line-chevron {
  color: var(--ink);
}

.line-chevron {
  transition: transform 120ms ease;
}

.line-chevron.is-open {
  transform: rotate(90deg);
}

.line-cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem 0.75rem;
}

.line-cells dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.line-cells dd {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
</style>
