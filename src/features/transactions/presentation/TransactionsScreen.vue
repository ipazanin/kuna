<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import { downloadFile } from '../../../shared/files/downloadFile'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { sumMoney } from '../../../shared/money/money'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../filters/application/filterStore'
import { DEFAULT_BUCKET_LABELS } from '../../settings/domain/settings'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { withoutChips } from '../../filters/domain/filterChips'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { counterpartyIdentity, counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useCollapsedGroups } from '../application/collapsedGroups'
import { transactionsCsv } from '../application/transactionsCsv'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { groupTransactions } from '../domain/transactionGroups'
import type { Grouping, TransactionGroup } from '../domain/transactionGroups'
import TransactionCards from './TransactionCards.vue'
import TransactionGroupHeading from './TransactionGroupHeading.vue'

const ledger = useFilteredLedger()
const { filters, setFilters, drillLocation } = useFilters()

const GROUPINGS: readonly { readonly label: string; readonly value: Grouping }[] = [
  { label: 'No grouping', value: 'none' },
  { label: 'By month', value: 'month' },
  { label: 'By category', value: 'category' },
  { label: 'By counterparty', value: 'counterparty' },
]

const groupBy = ref<Grouping>('none')
const sorting = ref<SortingState>([{ id: 'date', desc: true }])
const collapsed = useCollapsedGroups(() => groupBy.value)

// The search box writes to the shared filters after a pause, so the URL is not rewritten per key.
const search = ref(filters.value.text)
let pendingSearch: ReturnType<typeof setTimeout> | undefined
watch(search, (text) => {
  clearTimeout(pendingSearch)
  pendingSearch = setTimeout(() => {
    if (text !== filters.value.text) {
      void setFilters({ ...filters.value, text })
    }
  }, 250)
})
watch(
  () => filters.value.text,
  (text) => {
    search.value = text
  },
)
onBeforeUnmount(() => clearTimeout(pendingSearch))

const rows = computed<Transaction[]>(() => [...(ledger.value?.selected ?? [])])
const labels = computed(() => counterpartyLabels(ledger.value?.workbook.transactions ?? []))
const total = computed(() => sumMoney(rows.value.map((transaction) => transaction.amount)))
const severalAccounts = computed(() => new Set(rows.value.map((transaction) => transaction.account)).size > 1)

const phone = usePhoneLayout()
const names = useDisplayNames()

/** The table sorts manually, so groups keep their own order and the cards follow the same sort. */
const sortedRows = computed<Transaction[]>(() => {
  const [rule] = sorting.value
  const direction = rule?.desc === false ? 1 : -1
  return [...rows.value].sort((left, right) =>
    rule?.id === 'amount'
      ? direction * (left.amount - right.amount)
      : direction * (left.date.localeCompare(right.date) || left.sequence - right.sequence),
  )
})

const groups = computed<TransactionGroup[] | null>(() => {
  const shown = ledger.value
  return groupBy.value === 'none' || shown === null
    ? null
    : groupTransactions(sortedRows.value, groupBy.value, { window: shown.window, counterpartyLabels: labels.value })
})

const bucketLabels = computed(() => ledger.value?.workbook.settings.bucketLabels ?? DEFAULT_BUCKET_LABELS)

/** The table's rows: each group's heading, then its rows unless it is collapsed. */
type TableEntry = { readonly kind: 'group'; readonly group: TransactionGroup } | { readonly kind: 'row'; readonly transaction: Transaction }

const tableEntries = computed<TableEntry[]>(() =>
  groups.value === null
    ? sortedRows.value.map((transaction) => ({ kind: 'row', transaction }))
    : groups.value.flatMap((group): TableEntry[] => [
        { kind: 'group', group },
        ...(collapsed.isCollapsed(group.key) ? [] : group.rows.map((transaction): TableEntry => ({ kind: 'row', transaction }))),
      ]),
)

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function sortableHeader(label: string, alignEnd = false) {
  return ({ column }: { column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (descending?: boolean) => void } }) => {
    const sorted = column.getIsSorted()
    return h(UButton, {
      label,
      color: 'neutral',
      variant: 'ghost',
      size: 'xs',
      class: ['-mx-2 font-medium text-muted', alignEnd ? 'ms-auto' : ''],
      trailingIcon: sorted === 'asc' ? 'i-lucide-arrow-up' : sorted === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down',
      'aria-label': `Sort by ${label.toLowerCase()}`,
      onClick: () => column.toggleSorting(sorted === 'asc'),
    })
  }
}

function narrowTo(narrowing: Parameters<typeof drillToTransactions>[0]) {
  return drillLocation(drillToTransactions(narrowing))
}

type EntryCell = { readonly row: { readonly original: TableEntry } }

const isHeading = (cell: EntryCell): boolean => cell.row.original.kind === 'group'

/** A group's heading fills its whole row, so every other cell of that row is left out. */
function besideHeading(rowClass = ''): { class: { td: (cell: EntryCell) => string } } {
  return { class: { td: (cell) => (isHeading(cell) ? 'hidden' : rowClass) } }
}

const columns: TableColumn<TableEntry>[] = [
  {
    id: 'date',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.transaction.date : ''),
    header: sortableHeader('Date'),
    meta: {
      colspan: { td: (cell: EntryCell) => (isHeading(cell) ? String(COLUMN_COUNT) : '1') },
      class: { td: (cell: EntryCell) => (isHeading(cell) ? 'p-0' : '') },
    },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') {
        return h(TransactionGroupHeading, {
          group: entry.group,
          expanded: !collapsed.isCollapsed(entry.group.key),
          bucketLabels: bucketLabels.value,
          onToggle: () => collapsed.toggle(entry.group.key),
        })
      }
      return h('span', { class: 'figure whitespace-nowrap text-muted' }, dayFormat.format(new Date(entry.transaction.date)))
    },
  },
  {
    id: 'counterparty',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.transaction.counterparty : ''),
    header: 'Counterparty',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      const transaction = entry.transaction
      return h('div', { class: 'min-w-48 max-w-96' }, [
        h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(transaction).key] }), class: 'text-highlighted' }, () => transaction.counterparty || 'No counterparty'),
        transaction.description === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, transaction.description),
      ])
    },
  },
  {
    id: 'category',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.transaction.category : ''),
    header: 'Category',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      const transaction = entry.transaction
      return h('span', { class: 'inline-flex items-center gap-1.5 whitespace-nowrap text-toned' }, [
        h('span', { class: 'size-2 shrink-0 rounded-[2px]', style: { background: `var(--bucket-${bucketTone(transaction.bucket)})` }, 'aria-hidden': 'true' }),
        transaction.category === ''
          ? h('span', { class: 'text-muted' }, 'No category')
          : h(DrillLink, { to: narrowTo({ categories: [transaction.category] }) }, () => names.value.category(transaction.category)),
      ])
    },
  },
  {
    id: 'flag',
    header: 'Review',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.transaction.bucket === UNCLASSIFIED) return h(UBadge, { label: 'Unclassified', color: 'warning', variant: 'subtle', size: 'sm' })
      if (entry.transaction.flaggedBy === 'ai') return h(UBadge, { label: 'AI guess', color: 'info', variant: 'subtle', size: 'sm' })
      return ''
    },
  },
  {
    id: 'account',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.transaction.account : ''),
    header: 'Account',
    meta: besideHeading(),
    cell: ({ row }) => (row.original.kind === 'group' ? '' : h('span', { class: 'text-muted' }, names.value.account(row.original.transaction.account))),
  },
  {
    id: 'amount',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.transaction.amount : entry.group.total),
    header: sortableHeader('Amount', true),
    meta: { class: { th: 'text-end', ...besideHeading('text-end').class } },
    cell: ({ row }) => (row.original.kind === 'group' ? '' : h(MoneyText, { cents: row.original.transaction.amount, tone: 'flow' })),
    footer: () =>
      h('span', { class: 'inline-flex items-baseline gap-2' }, [
        h('span', { class: 'text-xs font-normal text-muted' }, `${rows.value.length} ${rows.value.length === 1 ? 'row' : 'rows'}, total`),
        h(MoneyText, { cents: total.value, class: 'font-semibold text-highlighted' }),
      ]),
  },
]

const COLUMN_COUNT = columns.length

function exportCsv(): void {
  downloadFile(transactionsCsv(rows.value), `ledgerboard-transactions-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Transactions" description="The rows behind every figure. Any number elsewhere opens here with its filters." />
    <LedgerGate>
      <template v-if="ledger">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

        <div class="flex flex-wrap items-center gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search counterparty, description, category, reference"
            aria-label="Search transactions"
            size="sm"
            class="w-full sm:w-96"
          />
          <USelect v-model="groupBy" :items="[...GROUPINGS]" size="sm" aria-label="Group rows" class="w-44" />
          <template v-if="groups">
            <UButton
              icon="i-lucide-chevrons-down-up"
              v-bind="phone ? {} : { label: 'Collapse all' }"
              aria-label="Collapse all"
              color="neutral"
              variant="ghost"
              size="sm"
              data-testid="collapse-all"
              @click="collapsed.collapseAll(groups.map((group) => group.key))"
            />
            <UButton
              icon="i-lucide-chevrons-up-down"
              v-bind="phone ? {} : { label: 'Expand all' }"
              aria-label="Expand all"
              color="neutral"
              variant="ghost"
              size="sm"
              data-testid="expand-all"
              @click="collapsed.expandAll()"
            />
          </template>
          <UButton
            icon="i-lucide-download"
            label="Export CSV"
            color="neutral"
            variant="outline"
            size="sm"
            class="sm:ms-auto"
            :disabled="rows.length === 0"
            @click="exportCsv"
          />
        </div>

        <UEmpty
          v-if="rows.length === 0"
          icon="i-lucide-search-x"
          title="No transactions match these filters"
          description="Clear a filter or pick a longer period."
          :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline', onClick: () => setFilters(withoutChips(filters)) }]"
          variant="outline"
          class="rounded-card bg-raised"
        />
        <TransactionCards
          v-else-if="phone"
          :rows="sortedRows"
          :groups="groups"
          :total="total"
          :bucket-labels="bucketLabels"
          :is-collapsed="collapsed.isCollapsed"
          :show-account="severalAccounts"
          @toggle="collapsed.toggle"
        />
        <div v-else class="overflow-hidden rounded-card border border-default bg-raised shadow-raised">
          <UTable
            v-model:sorting="sorting"
            :data="tableEntries"
            :columns="columns"
            :sorting-options="{ manualSorting: true }"
            :meta="{ class: { tr: (row: EntryCell['row']) => (row.original.kind === 'group' ? 'bg-elevated' : '') } }"
            :get-row-id="(entry: TableEntry) => (entry.kind === 'group' ? `group:${entry.group.key}` : `${entry.transaction.sheetRow}`)"
            sticky
            class="max-h-[70dvh]"
          />
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
