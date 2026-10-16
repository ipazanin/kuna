<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import { getGroupedRowModel } from '@tanstack/vue-table'
import type { ExpandedState, GroupingState, SortingState } from '@tanstack/vue-table'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { monthOf } from '../../../shared/calendar/monthKey'
import { downloadFile } from '../../../shared/files/downloadFile'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { sumMoney } from '../../../shared/money/money'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import { withoutChips } from '../../filters/domain/filterChips'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { counterpartyIdentity, counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { transactionsCsv } from '../application/transactionsCsv'
import { useFilteredLedger } from '../application/useFilteredLedger'
import TransactionCards from './TransactionCards.vue'

const ledger = useFilteredLedger()
const { filters, setFilters, drillLocation } = useFilters()

const GROUPINGS = [
  { label: 'No grouping', value: 'none' },
  { label: 'By month', value: 'month' },
  { label: 'By category', value: 'category' },
  { label: 'By counterparty', value: 'payee' },
] as const

type Grouping = (typeof GROUPINGS)[number]['value']

const groupBy = ref<Grouping>('none')
const grouping = computed<GroupingState>({
  get: () => (groupBy.value === 'none' ? [] : [groupBy.value]),
  set: (columns) => {
    groupBy.value = (columns[0] as Grouping | undefined) ?? 'none'
  },
})
const sorting = ref<SortingState>([{ id: 'date', desc: true }])
const expanded = ref<ExpandedState>(true)
/** Month and counterparty label exist only to group by. */
const columnVisibility = { month: false, payee: false }

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

const phone = usePhoneLayout()

/** The cards follow the table's sort, which only the table's headers change. */
const sortedRows = computed<Transaction[]>(() => {
  const [rule] = sorting.value
  const direction = rule?.desc === false ? 1 : -1
  return [...rows.value].sort((left, right) =>
    rule?.id === 'amount'
      ? direction * (left.amount - right.amount)
      : direction * (left.date.localeCompare(right.date) || left.sequence - right.sequence),
  )
})

/** What each grouping groups by, for the table's grouped rows and the cards' headings alike. */
const GROUP_KEYS: Readonly<Record<Exclude<Grouping, 'none'>, (transaction: Transaction) => string>> = {
  month: (transaction) => monthLabel(monthOf(transaction.date)),
  category: (transaction) => transaction.category || 'no category',
  payee: (transaction) => labels.value.get(counterpartyIdentity(transaction).key) ?? '',
}

const groupOf = computed(() => (groupBy.value === 'none' ? null : GROUP_KEYS[groupBy.value]))

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

const columns: TableColumn<Transaction>[] = [
  { id: 'month', accessorFn: GROUP_KEYS.month, header: 'Month' },
  { id: 'payee', accessorFn: GROUP_KEYS.payee, header: 'Counterparty' },
  {
    id: 'date',
    accessorFn: (transaction) => transaction.date,
    header: sortableHeader('Date'),
    sortingFn: (left, right) =>
      left.original.date.localeCompare(right.original.date) || left.original.sequence - right.original.sequence,
    cell: ({ row }) => {
      if (row.getIsGrouped()) {
        const count = row.subRows.length
        return h('span', { class: 'font-medium text-highlighted' }, `${String(row.getValue(row.groupingColumnId ?? ''))}, ${count} ${count === 1 ? 'row' : 'rows'}`)
      }
      return h('span', { class: 'figure whitespace-nowrap text-muted' }, dayFormat.format(new Date(row.original.date)))
    },
  },
  {
    id: 'counterparty',
    accessorFn: (transaction) => transaction.counterparty,
    header: 'Counterparty',
    cell: ({ row }) => {
      if (row.getIsGrouped()) return ''
      const transaction = row.original
      return h('div', { class: 'min-w-48 max-w-96' }, [
        h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(transaction).key] }), class: 'text-highlighted' }, () => transaction.counterparty || 'No counterparty'),
        transaction.description === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, transaction.description),
      ])
    },
  },
  {
    id: 'category',
    accessorFn: GROUP_KEYS.category,
    header: 'Category',
    cell: ({ row }) => {
      if (row.getIsGrouped()) return ''
      const transaction = row.original
      return h('span', { class: 'inline-flex items-center gap-1.5 whitespace-nowrap text-toned' }, [
        h('span', { class: 'size-2 shrink-0 rounded-[2px]', style: { background: `var(--bucket-${transaction.bucket === UNCLASSIFIED ? 'neutral' : transaction.bucket})` }, 'aria-hidden': 'true' }),
        transaction.category === ''
          ? h('span', { class: 'text-muted' }, 'no category')
          : h(DrillLink, { to: narrowTo({ categories: [transaction.category] }) }, () => transaction.category),
      ])
    },
  },
  {
    id: 'flag',
    header: 'Review',
    cell: ({ row }) => {
      if (row.getIsGrouped()) return ''
      const transaction = row.original
      if (transaction.bucket === UNCLASSIFIED) return h(UBadge, { label: 'Unclassified', color: 'warning', variant: 'subtle', size: 'sm' })
      if (transaction.flaggedBy === 'ai') return h(UBadge, { label: 'AI guess', color: 'info', variant: 'subtle', size: 'sm' })
      return ''
    },
  },
  {
    accessorKey: 'account',
    header: 'Account',
    cell: ({ row }) => (row.getIsGrouped() ? '' : h('span', { class: 'text-muted' }, row.original.account)),
  },
  {
    id: 'amount',
    accessorFn: (transaction) => transaction.amount,
    header: sortableHeader('Amount', true),
    aggregationFn: 'sum',
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) =>
      h(MoneyText, {
        cents: Number(row.getValue('amount')),
        toned: !row.getIsGrouped(),
        class: row.getIsGrouped() ? 'font-medium text-highlighted' : '',
      }),
    footer: () =>
      h('span', { class: 'inline-flex items-baseline gap-2' }, [
        h('span', { class: 'text-xs font-normal text-muted' }, `${rows.value.length} ${rows.value.length === 1 ? 'row' : 'rows'}, total`),
        h(MoneyText, { cents: total.value, class: 'font-semibold text-highlighted' }),
      ]),
  },
]

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
        <TransactionCards v-else-if="phone" :rows="sortedRows" :group-of="groupOf" :total="total" />
        <div v-else class="overflow-hidden rounded-card border border-default bg-raised shadow-raised">
          <UTable
            v-model:sorting="sorting"
            v-model:grouping="grouping"
            v-model:expanded="expanded"
            :column-visibility="columnVisibility"
            :data="rows"
            :columns="columns"
            :grouping-options="{ groupedColumnMode: false, getGroupedRowModel: getGroupedRowModel() }"
            :get-row-id="(transaction: Transaction) => `${transaction.sheetRow}`"
            sticky
            class="max-h-[70dvh]"
          />
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
