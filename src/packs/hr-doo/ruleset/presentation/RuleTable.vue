<script setup lang="ts">
import { computed } from 'vue'

import type { TableView } from './ruleWording'

/** A table term: a plain table on a wide screen, one small card per row on a phone. */
const props = defineProps<{
  table: TableView
  phone: boolean
}>()

/** On a phone the first text column names the row, and the other columns follow as label and value. */
const titleColumn = computed(() => props.table.textColumns.indexOf(true))
</script>

<template>
  <section class="flex min-w-0 flex-col gap-1.5" :aria-label="table.label">
    <h4 class="text-xs font-medium text-muted">{{ table.label }}</h4>

    <ul v-if="phone" class="flex flex-col gap-2">
      <li v-for="row in table.rows" :key="row.key" class="flex flex-col gap-1.5">
        <p v-if="row.period !== null" class="figure pt-1 text-xs font-medium text-highlighted">{{ row.period }}</p>
        <div class="rounded-control border border-default px-3 py-2">
          <p v-if="titleColumn >= 0" class="text-sm text-highlighted" :class="{ 'is-changed': row.cells[titleColumn]?.changed }">
            {{ row.cells[titleColumn]?.wording }}
          </p>
          <dl class="phone-cells">
            <div v-for="(cell, index) in row.cells" v-show="index !== titleColumn" :key="index" class="flex items-baseline justify-between gap-3">
              <dt class="text-xs text-muted">{{ table.headers[index] }}</dt>
              <dd class="figure text-end text-sm" :class="cell.changed ? 'is-changed' : 'text-default'">{{ cell.wording }}</dd>
            </div>
          </dl>
        </div>
      </li>
    </ul>

    <div v-else class="overflow-x-auto rounded-control border border-default">
      <table class="data-table term-table w-full text-sm">
        <thead>
          <tr>
            <th v-if="table.byPeriod" scope="col" class="text-start">Period</th>
            <th v-for="(header, index) in table.headers" :key="header" scope="col" :class="table.textColumns[index] ? 'text-start' : 'text-end'">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in table.rows" :key="row.key" :class="{ 'starts-period': table.byPeriod && row.period !== null }">
            <th v-if="row.period !== null" scope="rowgroup" :rowspan="row.periodSpan" class="figure text-start align-top font-medium text-highlighted">{{ row.period }}</th>
            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              :class="[table.textColumns[index] ? 'text-start whitespace-normal' : 'figure text-end', cell.changed ? 'is-changed' : 'text-default']"
            >
              {{ cell.wording }}<span v-if="cell.changed" class="sr-only">, changed</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.term-table th,
.term-table td {
  padding: 0.375rem 0.625rem;
}

.term-table td.whitespace-normal {
  min-width: 10rem;
}

/* The rowspan cell sits in the group's first row only, so the group's top rule needs the row itself. */
.term-table tbody tr.starts-period > * {
  border-top: 1px solid var(--border-strong);
}

.term-table tbody tr:first-child > * {
  border-top: 0;
}

.term-table tbody th[rowspan] {
  border-inline-end: 1px solid var(--border-default);
}

.phone-cells > div + div {
  margin-top: 0.25rem;
}

.is-changed {
  color: var(--ink-strong);
  font-weight: 500;
}

td.is-changed {
  box-shadow: inset 2px 0 0 var(--accent);
}
</style>
