<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useMediaQuery } from '../../../../../../shared/layout/viewport'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { GROUP_LABELS } from './payScenariosView'
import type { FigureDetail } from '../tracedFigureView'
import type { ComparedCell, ComparedLine, LineGroup, ScenarioColumn } from './payScenariosView'

/**
 * The lines of each scenario side by side, the base first. The best value of a line that has a
 * better direction is marked, and every figure opens its build-up. Below the lg breakpoint, where
 * four columns of figures do not fit, the base sits beside one other scenario, picked above the table.
 */
const props = defineProps<{
  columns: readonly ScenarioColumn[]
  lines: readonly ComparedLine[]
}>()

const emit = defineEmits<{
  open: [detail: FigureDetail]
}>()

const narrow = useMediaQuery('(max-width: 1023px)')
const against = ref<string | null>(null)

/** The columns on screen, by their place among all of them. */
const shownColumns = computed(() => {
  const all = props.columns.map((column, index) => ({ column, index }))
  if (!narrow.value || all.length <= 2) return all
  const picked = all.find((entry) => entry.index > 0 && entry.column.slug === against.value) ?? all[1]
  return all.filter((entry) => entry.index === 0 || entry === picked)
})

/** The lines by group, each with the cells of the columns on screen. */
const groups = computed(() => {
  const order: LineGroup[] = ['net', 'pension', 'company', 'state', 'kept']
  const shownCells = (line: ComparedLine) =>
    shownColumns.value.flatMap(({ column, index }) => {
      const cell = line.cells[index]
      return cell === undefined ? [] : [{ column, cell }]
    })
  return order
    .map((group) => ({ group, label: GROUP_LABELS[group], lines: props.lines.filter((line) => line.group === group).map((line) => ({ line, cells: shownCells(line) })) }))
    .filter((entry) => entry.lines.length > 0)
})

function cellLabel(line: ComparedLine, cell: ComparedCell, column: ScenarioColumn): string {
  return `${line.label}, ${column.label}${cell.best ? ', the best' : ''}: open how it is built`
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="scenario-comparison">
    <div v-if="narrow && columns.length > 2" class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Scenario beside the base" data-testid="comparison-against">
      <span class="me-1 text-sm text-toned">Beside the base</span>
      <UButton
        v-for="entry in columns.slice(1)"
        :key="entry.slug"
        :label="entry.label"
        size="sm"
        color="neutral"
        :variant="shownColumns[1]?.column.slug === entry.slug ? 'solid' : 'outline'"
        :aria-pressed="shownColumns[1]?.column.slug === entry.slug"
        @click="against = entry.slug"
      />
    </div>
    <table class="comparison" :class="{ 'is-narrow': narrow }">
      <thead>
        <tr>
          <th scope="col" class="line-head"><span class="sr-only">Line</span></th>
          <th v-for="entry in shownColumns" :key="entry.column.slug" scope="col" class="figure-head">
            <span class="block text-sm font-medium text-highlighted">{{ entry.column.label }}</span>
            <span v-if="entry.column.isBase" class="block text-xs font-normal text-muted">The base, others against it</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="entry in groups" :key="entry.group">
        <tr>
          <th :colspan="shownColumns.length + 1" scope="colgroup" class="group-head">{{ entry.label }}</th>
        </tr>
        <tr v-for="{ line, cells } in entry.lines" :key="line.key" :class="{ 'is-total': line.total }" :data-line="line.key">
          <th scope="row" class="line-label" :class="line.total ? 'font-medium text-highlighted' : 'font-normal text-toned'">{{ line.label }}</th>
          <td v-for="{ column, cell } in cells" :key="column.slug" class="figure-cell">
            <button type="button" class="figure-button" :aria-label="cellLabel(line, cell, column)" @click="emit('open', cell.detail)">
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

.figure-button:hover {
  background: var(--surface-elevated);
}

.comparison.is-narrow .line-head {
  width: 40%;
}
</style>
