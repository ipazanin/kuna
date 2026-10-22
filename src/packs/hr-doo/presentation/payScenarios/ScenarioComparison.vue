<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useMediaQuery } from '../../../../shared/layout/viewport'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { GROUP_LABELS } from './payScenariosView'
import type { FigureDetail } from '../tracedFigureView'
import type { ComparedCell, ComparedLine, LineGroup, ScenarioColumn } from './payScenariosView'

/**
 * The lines of each scenario side by side: a table on a wide screen, one card per line below the
 * lg breakpoint, where four columns of figures do not fit. The best value of a line that has a
 * better direction is marked, and every figure opens its build-up.
 */
const props = defineProps<{
  columns: readonly ScenarioColumn[]
  lines: readonly ComparedLine[]
}>()

const emit = defineEmits<{
  open: [detail: FigureDetail]
}>()

const narrow = useMediaQuery('(max-width: 1023px)')

const groups = computed(() => {
  const order: LineGroup[] = ['net', 'pension', 'company', 'state', 'kept']
  return order.map((group) => ({ group, label: GROUP_LABELS[group], lines: props.lines.filter((line) => line.group === group) })).filter((entry) => entry.lines.length > 0)
})

function cellLabel(line: ComparedLine, cell: ComparedCell, column: ScenarioColumn | undefined): string {
  return `${line.label}, ${column?.label ?? ''}${cell.best ? ', the best' : ''}: open how it is built`
}
</script>

<template>
  <div data-testid="scenario-comparison">
    <table v-if="!narrow" class="comparison">
      <thead>
        <tr>
          <th scope="col" class="line-head"><span class="sr-only">Line</span></th>
          <th v-for="column in columns" :key="column.slug" scope="col" class="figure-head">
            <span class="block text-sm font-medium text-highlighted">{{ column.label }}</span>
            <span v-if="column.isBase" class="block text-xs font-normal text-muted">The base, others against it</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="entry in groups" :key="entry.group">
        <tr>
          <th :colspan="columns.length + 1" scope="colgroup" class="group-head">{{ entry.label }}</th>
        </tr>
        <tr v-for="line in entry.lines" :key="line.key" :class="{ 'is-total': line.total }" :data-line="line.key">
          <th scope="row" class="line-label" :class="line.total ? 'font-medium text-highlighted' : 'font-normal text-toned'">{{ line.label }}</th>
          <td v-for="(cell, index) in line.cells" :key="columns[index]?.slug" class="figure-cell">
            <button type="button" class="figure-button" :class="{ 'is-best': cell.best }" :aria-label="cellLabel(line, cell, columns[index])" @click="emit('open', cell.detail)">
              <span class="inline-flex items-center gap-1">
                <UIcon v-if="cell.best" name="i-lucide-circle-check" class="size-3.5 text-[var(--tone-positive)]" aria-hidden="true" />
                <MoneyText :cents="cell.cents" :class="line.total || cell.best ? 'font-medium text-highlighted' : 'text-toned'" />
              </span>
              <MoneyText v-if="cell.vsBase !== null && cell.vsBase !== 0" :cents="cell.vsBase" sign="always" class="block text-xs text-muted" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="flex flex-col gap-5">
      <section v-for="entry in groups" :key="entry.group" :aria-label="entry.label">
        <h3 class="mb-2 text-xs font-medium text-muted">{{ entry.label }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="line in entry.lines" :key="line.key" class="line-card" :data-line="line.key">
            <p class="text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'">{{ line.label }}</p>
            <ul class="mt-1 flex flex-col">
              <li v-for="(cell, index) in line.cells" :key="columns[index]?.slug">
                <button type="button" class="card-figure" :aria-label="cellLabel(line, cell, columns[index])" @click="emit('open', cell.detail)">
                  <span class="min-w-0 text-start text-xs text-muted">{{ columns[index]?.label }}</span>
                  <span class="flex shrink-0 flex-col items-end">
                    <span class="inline-flex items-center gap-1">
                      <UIcon v-if="cell.best" name="i-lucide-circle-check" class="size-3.5 text-[var(--tone-positive)]" aria-hidden="true" />
                      <MoneyText :cents="cell.cents" class="text-sm" :class="cell.best ? 'font-medium text-highlighted' : 'text-toned'" />
                    </span>
                    <MoneyText v-if="cell.vsBase !== null && cell.vsBase !== 0" :cents="cell.vsBase" sign="always" class="text-xs text-muted" />
                  </span>
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.comparison {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.line-head {
  width: 34%;
}

.figure-head {
  padding: 0 0.5rem 0.5rem;
  text-align: end;
  vertical-align: bottom;
}

.group-head {
  padding: 1rem 0 0.375rem;
  text-align: start;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
}

.line-label {
  padding: 0.25rem 0.75rem 0.25rem 0;
  text-align: start;
  font-size: 0.875rem;
}

tbody tr + tr {
  border-top: 1px solid var(--border-default);
}

tr.is-total {
  border-top-color: var(--border-strong);
}

.figure-cell {
  text-align: end;
}

.figure-button {
  display: inline-flex;
  min-height: 2.75rem;
  width: 100%;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-control);
  font-size: 0.875rem;
}

.figure-button:hover,
.card-figure:hover {
  background: var(--surface-elevated);
}

.line-card {
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  padding: 0.5rem 0.75rem;
}

.card-figure {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: var(--radius-control);
}
</style>
