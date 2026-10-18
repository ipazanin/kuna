<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { fold } from '../../../../shared/text/fold'
import type { TableFocus, TableRowView, TableView } from './ruleWording'

/** A table term: a plain table on a wide screen, one small card per row on a phone. A long one opens on its focus row and a search. */
const props = withDefaults(
  defineProps<{
    table: TableView
    phone: boolean
    focus?: TableFocus | null
  }>(),
  { focus: null },
)

/** On a phone the first text column names the row, and the other columns follow as label and value. */
const titleColumn = computed(() => props.table.textColumns.indexOf(true))

const search = ref('')
const showAll = ref(false)
const searchWords = computed(() => fold(search.value).split(' ').filter((word) => word !== ''))

function isFocused(row: TableRowView): boolean {
  const cells = props.focus?.cells ?? null
  return cells !== null && cells.every((wording) => row.cells.some((cell) => cell.wording === wording))
}

function matchesSearch(text: string): boolean {
  return searchWords.value.every((word) => text.includes(word))
}

/** Rows whose name matches the search, else rows matching anywhere, so "split" finds Grad Split before its county's other units. */
function searchMatches(): readonly TableRowView[] {
  const byName = props.table.rows.filter((row) => matchesSearch(fold(row.cells[titleColumn.value]?.wording ?? '')))
  return byName.length > 0 ? byName : props.table.rows.filter((row) => matchesSearch(row.searchText))
}

/** The rows a long table shows: the search matches, else every row or the focus rows, with the focus first in each period. */
const rowsShown = computed((): readonly TableRowView[] => {
  if (!props.table.long) {
    return props.table.rows
  }
  const picked = searchWords.value.length > 0 ? searchMatches() : props.table.rows.filter((row) => showAll.value || isFocused(row))
  const groups = new Map<string, TableRowView[]>()
  for (const row of picked) {
    const inGroup = groups.get(row.group)
    if (inGroup === undefined) {
      groups.set(row.group, [row])
    } else {
      inGroup.push(row)
    }
  }
  return [...groups.values()].flatMap((inGroup) =>
    [...inGroup.filter(isFocused), ...inGroup.filter((row) => !isFocused(row))].map((row, index) => ({
      ...row,
      period: props.table.byPeriod && index === 0 ? row.group : null,
      periodSpan: inGroup.length,
    })),
  )
})

/** The focus rows are tinted only among other rows, where they need finding. */
const focusMarked = computed(() => props.table.long && (showAll.value || searchWords.value.length > 0))

const status = computed(() => (rowsShown.value.length === props.table.rows.length ? `All ${props.table.rows.length} rows` : `${rowsShown.value.length} of ${props.table.rows.length} rows`))
</script>

<template>
  <section class="flex min-w-0 flex-col gap-1.5" :aria-label="table.label">
    <h4 class="text-xs font-medium text-muted">{{ table.label }}</h4>

    <div v-if="table.long" class="flex flex-col gap-2" data-testid="long-table-controls">
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          enterkeyhint="search"
          :placeholder="`Search ${table.label.toLowerCase()}`"
          :aria-label="`Search ${table.label.toLowerCase()}`"
          class="table-search"
          data-testid="table-search"
        >
          <template v-if="search" #trailing>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Clear the table search" @click="search = ''" />
          </template>
        </UInput>
        <UButton
          :label="showAll ? 'Show fewer' : 'Show all'"
          color="neutral"
          variant="outline"
          :aria-pressed="showAll"
          data-testid="table-show-all"
          @click="showAll = !showAll; search = ''"
        />
        <p class="figure text-xs text-muted" aria-live="polite" data-testid="table-count">{{ status }}</p>
      </div>
      <p v-if="rowsShown.length === 0" class="text-sm text-muted">
        {{ search === '' ? focus?.hint ?? `Search above, or show all ${table.rows.length} rows.` : `No row matches "${search}".` }}
      </p>
    </div>

    <ul v-if="phone && rowsShown.length > 0" class="flex flex-col gap-2">
      <li v-for="row in rowsShown" :key="row.key" class="flex flex-col gap-1.5">
        <p v-if="row.period !== null" class="figure pt-1 text-xs font-medium text-highlighted">{{ row.period }}</p>
        <div class="rounded-control border border-default px-3 py-2" :class="{ 'is-focus': focusMarked && isFocused(row) }">
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

    <div v-else-if="rowsShown.length > 0" class="overflow-x-auto rounded-control border border-default">
      <table class="data-table term-table w-full text-sm">
        <thead>
          <tr>
            <th v-if="table.byPeriod" scope="col" class="text-start">Period</th>
            <th v-for="(header, index) in table.headers" :key="header" scope="col" :class="table.textColumns[index] ? 'text-start' : 'text-end'">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rowsShown" :key="row.key" :class="{ 'starts-period': table.byPeriod && row.period !== null, 'is-focus': focusMarked && isFocused(row) }">
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
.table-search {
  width: 100%;
}

@media (min-width: 640px) {
  .table-search {
    width: 18rem;
  }
}

/* The focus row, so it stands out among the rows a search or Show all adds. */
.is-focus,
tr.is-focus > td {
  background: var(--accent-wash);
}

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
