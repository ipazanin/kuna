<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref, watch } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
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
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useCollapsedGroups } from '../application/collapsedGroups'
import { transactionsCsv } from '../application/transactionsCsv'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { advancesLeftOutByBankFilters } from '../domain/filterTransactions'
import { inBookingOrder, listedRows } from '../domain/listedRows'
import type { ListedRow } from '../domain/listedRows'
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

const rows = computed<ListedRow[]>(() => listedRows(ledger.value?.selected ?? [], ledger.value?.selectedAdvances ?? []))
const labels = computed(() => counterpartyLabels(ledger.value?.workbook.transactions ?? []))
const total = computed(() => sumMoney(rows.value.map((row) => row.amount)))
const severalAccounts = computed(() => new Set(rows.value.flatMap((row) => (row.kind === 'bank' ? [row.account] : []))).size > 1)

/** Advances in the period that only the account, counterparty or review filter keeps off the list, said in words. */
const advancesLeftOut = computed(() => {
  const shown = ledger.value
  const count = shown === null ? 0 : advancesLeftOutByBankFilters(shown.workbook.ownerAdvances, shown.filters, shown.window)
  if (shown === null || count === 0) {
    return null
  }
  const { accounts, counterparties, needsReview } = shown.filters
  const filters = [accounts.length > 0 ? 'account' : '', counterparties.length > 0 ? 'counterparty' : '', needsReview ? 'review' : ''].filter((name) => name !== '')
  const named = filters.length === 1 ? `the ${filters[0]} filter` : `the ${filters.slice(0, -1).join(', ')} and ${filters[filters.length - 1]} filters`
  return `${count} owner ${count === 1 ? 'advance' : 'advances'} in this period ${count === 1 ? 'is' : 'are'} not listed, because ${named} ${filters.length === 1 ? 'leaves' : 'leave'} ${count === 1 ? 'it' : 'them'} out. An advance was paid from the owner's own money, so it has no bank account, no counterparty in the ledger, and never waits for review.`
})

const phone = usePhoneLayout()
const names = useDisplayNames()

/** The table sorts manually, so groups keep their own order and the cards follow the same sort. */
const sortedRows = computed<ListedRow[]>(() => {
  const [rule] = sorting.value
  const direction = rule?.desc === false ? 1 : -1
  return [...rows.value].sort((left, right) => direction * (rule?.id === 'amount' ? left.amount - right.amount : inBookingOrder(left, right)))
})

const groups = computed<TransactionGroup[] | null>(() => {
  const shown = ledger.value
  return groupBy.value === 'none' || shown === null
    ? null
    : groupTransactions(sortedRows.value, groupBy.value, { window: shown.window, counterpartyLabels: labels.value })
})

const bucketLabels = computed(() => ledger.value?.workbook.settings.bucketLabels ?? DEFAULT_BUCKET_LABELS)

/** The table's rows: each group's heading, then its rows unless it is collapsed. */
type TableEntry = { readonly kind: 'group'; readonly group: TransactionGroup } | { readonly kind: 'row'; readonly row: ListedRow }

const tableEntries = computed<TableEntry[]>(() =>
  groups.value === null
    ? sortedRows.value.map((row) => ({ kind: 'row', row }))
    : groups.value.flatMap((group): TableEntry[] => [
        { kind: 'group', group },
        ...(collapsed.isCollapsed(group.key) ? [] : group.rows.map((row): TableEntry => ({ kind: 'row', row }))),
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
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.date : ''),
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
      return h('span', { class: 'figure whitespace-nowrap text-muted' }, dayFormat.format(new Date(entry.row.date)))
    },
  },
  {
    id: 'counterparty',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.counterparty : ''),
    header: 'Counterparty',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      const listed = entry.row
      // An advance has no counterparty in the ledger, so a counterparty filter would leave it out.
      const name =
        listed.kind === 'bank'
          ? h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(listed).key] }), class: 'text-highlighted' }, () => listed.counterparty || 'No counterparty')
          : h('span', { class: 'inline-flex items-center gap-2 text-highlighted' }, [listed.counterparty, h(UBadge, { label: listed.label, color: 'neutral', variant: 'subtle', size: 'sm' })])
      return h('div', { class: 'min-w-48 max-w-96' }, [name, listed.description === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, listed.description)])
    },
  },
  {
    id: 'category',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.category : ''),
    header: 'Category',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      const listed = entry.row
      return h('span', { class: 'inline-flex items-center gap-1.5 whitespace-nowrap text-toned' }, [
        h('span', { class: 'size-2 shrink-0 rounded-[2px]', style: { background: `var(--bucket-${bucketTone(listed.bucket)})` }, 'aria-hidden': 'true' }),
        listed.category === ''
          ? h('span', { class: 'text-muted' }, 'No category')
          : h(DrillLink, { to: narrowTo({ categories: [listed.category] }) }, () => names.value.category(listed.category)),
      ])
    },
  },
  {
    id: 'flag',
    header: 'Review',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group' || entry.row.kind === 'owner-advance') return ''
      if (entry.row.bucket === UNCLASSIFIED) return h(UBadge, { label: 'Unclassified', color: 'warning', variant: 'subtle', size: 'sm' })
      if (entry.row.flaggedBy === 'ai') return h(UBadge, { label: 'AI guess', color: 'info', variant: 'subtle', size: 'sm' })
      return ''
    },
  },
  {
    id: 'account',
    accessorFn: (entry) => (entry.kind === 'row' && entry.row.kind === 'bank' ? entry.row.account : ''),
    header: 'Account',
    meta: besideHeading(),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      return entry.row.kind === 'bank'
        ? h('span', { class: 'text-muted' }, names.value.account(entry.row.account))
        : h('span', { class: 'text-muted' }, 'No bank account')
    },
  },
  {
    id: 'amount',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.amount : entry.group.total),
    header: sortableHeader('Amount', true),
    meta: { class: { th: 'text-end', ...besideHeading('text-end').class } },
    cell: ({ row }) => (row.original.kind === 'group' ? '' : h(MoneyText, { cents: row.original.row.amount, tone: 'flow' })),
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
  <section class="flex max-w-measure flex-col gap-6">
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

        <p v-if="advancesLeftOut" class="flex items-start gap-2 text-xs text-muted" data-testid="advances-left-out">
          <UIcon name="i-lucide-info" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{{ advancesLeftOut }}</span>
        </p>

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
            :get-row-id="(entry: TableEntry) => (entry.kind === 'group' ? `group:${entry.group.key}` : entry.row.key)"
            sticky
            class="max-h-[70dvh]"
          />
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
