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
import AppCard from '../../../shared/ui/AppCard.vue'
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
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useCollapsedGroups } from '../application/collapsedGroups'
import { transactionsCsv } from '../application/transactionsCsv'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { advancesLeftOutByBankFilters } from '../domain/filterTransactions'
import { OWNER_ADVANCE_LABEL, inBookingOrder, listedRows, withSplitHeadings } from '../domain/listedRows'
import type { ListedEntry, ListedRow } from '../domain/listedRows'
import { groupTransactions } from '../domain/transactionGroups'
import type { Grouping, TransactionGroup } from '../domain/transactionGroups'
import type { LedgerSplit } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import SplitDialog from './SplitDialog.vue'
import TransactionCards from './TransactionCards.vue'
import TransactionGroupHeading from './TransactionGroupHeading.vue'

const ledger = useFilteredLedger()
const { filters, setFilters, drillLocation } = useFilters()
const { state } = useWorkbook()

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

/** The table's rows: each group's heading, then its rows unless it is collapsed, a split payment's parts under the payment. */
type TableEntry = { readonly kind: 'group'; readonly group: TransactionGroup } | ListedEntry

const tableEntries = computed<TableEntry[]>(() =>
  groups.value === null
    ? withSplitHeadings(sortedRows.value)
    : groups.value.flatMap((group): TableEntry[] => [{ kind: 'group', group }, ...(collapsed.isCollapsed(group.key) ? [] : withSplitHeadings(group.rows))]),
)

/** The payment the split editor is open on, with its split on the splits tab or null. */
const splitting = ref<{ readonly row: Transaction; readonly split: LedgerSplit | null } | null>(null)
const splitOpen = ref(false)

function splitOf(row: Transaction): LedgerSplit | null {
  return ledger.value?.workbook.splits.find((split) => split.row.sheetRow === row.sheetRow) ?? null
}

/** A split read from a private share still on the owner-advances tab is moved on Owner or Review, not edited here. */
function waitsToMove(row: Transaction): boolean {
  return splitOf(row)?.parts.some((part) => part.sheetRow === null) ?? false
}

function openSplit(row: Transaction): void {
  splitting.value = { row, split: splitOf(row) }
  splitOpen.value = true
}

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

const isPart = (entry: TableEntry): boolean => entry.kind === 'row' && entry.row.kind === 'bank' && entry.row.split !== undefined

/** A group's heading fills its whole row, so every other cell of that row is left out. */
function besideHeading(rowClass = ''): { class: { td: (cell: EntryCell) => string } } {
  return { class: { td: (cell) => (isHeading(cell) ? 'hidden' : rowClass) } }
}

/** Why a row waits for review, beside its category. */
function reviewBadge(listed: ListedRow) {
  if (listed.kind === 'owner-advance') return null
  if (listed.bucket === UNCLASSIFIED) return h(UBadge, { label: 'Unclassified', color: 'warning', variant: 'subtle', size: 'sm' })
  if (listed.flaggedBy === 'ai') return h(UBadge, { label: 'AI guess', color: 'info', variant: 'subtle', size: 'sm' })
  return null
}

function categoryOf(listed: ListedRow) {
  return h('span', { class: 'inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-toned' }, [
    h('span', { class: 'inline-flex items-center gap-1.5' }, [
      h('span', { class: 'size-2 shrink-0 rounded-[2px]', style: { background: `var(--bucket-${bucketTone(listed.bucket)})` }, 'aria-hidden': 'true' }),
      listed.category === ''
        ? h('span', { class: 'text-muted' }, 'No category')
        : h(DrillLink, { to: narrowTo({ categories: [listed.category] }) }, () => names.value.category(listed.category)),
    ]),
    reviewBadge(listed),
  ])
}

/** Below a container width the category column drops out and the category moves under the row's name. */
function categoryBelowName(listed: ListedRow) {
  return h('div', { class: 'mt-1 text-sm @2xl:hidden' }, [categoryOf(listed)])
}

const columns: TableColumn<TableEntry>[] = [
  {
    id: 'date',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.date : entry.kind === 'split' ? entry.whole.date : ''),
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
      if (entry.kind === 'split') {
        return h('span', { class: 'figure whitespace-nowrap text-muted' }, dayFormat.format(new Date(entry.whole.date)))
      }
      return isPart(entry) ? '' : h('span', { class: 'figure whitespace-nowrap text-muted' }, dayFormat.format(new Date(entry.row.date)))
    },
  },
  {
    id: 'counterparty',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.counterparty : entry.kind === 'split' ? entry.whole.counterparty : ''),
    header: 'Counterparty',
    meta: besideHeading('whitespace-normal'),
    footer: () => h('span', { class: 'text-xs font-normal text-muted' }, `${rows.value.length} ${rows.value.length === 1 ? 'row' : 'rows'}`),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind === 'split') {
        const { whole } = entry
        return h('div', { class: 'min-w-40 max-w-56 @4xl:max-w-96' }, [
          h('span', { class: 'inline-flex flex-wrap items-center gap-2 text-highlighted' }, [
            h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(whole).key] }), class: 'text-highlighted' }, () => whole.counterparty || 'No counterparty'),
            h(UBadge, { label: waitsToMove(whole) ? 'Private share to move' : `Split in ${entry.count} parts`, color: 'neutral', variant: 'subtle', size: 'sm' }),
          ]),
          whole.description === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, whole.description),
        ])
      }
      const listed = entry.row
      if (listed.kind === 'bank' && listed.split !== undefined) {
        const { split } = listed
        return h('div', { class: 'min-w-40 max-w-56 ps-4 @4xl:max-w-96' }, [
          h('span', { class: 'inline-flex items-center gap-1.5 text-toned' }, [
            h(UIcon, { name: 'i-lucide-corner-down-right', class: 'size-3.5 shrink-0 text-muted', 'aria-hidden': 'true' }),
            `Part ${split.index + 1} of ${split.count}`,
          ]),
          split.note === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, split.note),
          categoryBelowName(listed),
        ])
      }
      // An advance has no counterparty in the ledger, so a counterparty filter would leave it out.
      const name =
        listed.kind === 'bank'
          ? h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(listed).key] }), class: 'text-highlighted' }, () => listed.counterparty || 'No counterparty')
          : h('span', { class: 'inline-flex items-center gap-2 text-highlighted' }, [listed.counterparty, h(UBadge, { label: OWNER_ADVANCE_LABEL, color: 'neutral', variant: 'subtle', size: 'sm' })])
      return h('div', { class: 'min-w-40 max-w-56 @4xl:max-w-96' }, [
        name,
        listed.description === '' ? null : h('p', { class: 'truncate text-xs text-muted' }, listed.description),
        categoryBelowName(listed),
      ])
    },
  },
  {
    id: 'category',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.category : ''),
    header: 'Category',
    meta: { class: { th: 'hidden @2xl:table-cell', ...besideHeading('hidden whitespace-normal @2xl:table-cell').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind === 'split') return h('span', { class: 'text-xs text-muted' }, 'Counts as its parts')
      return categoryOf(entry.row)
    },
  },
  {
    id: 'account',
    accessorFn: (entry) => (entry.kind === 'row' && entry.row.kind === 'bank' ? entry.row.account : entry.kind === 'split' ? entry.whole.account : ''),
    header: 'Account',
    // The account is the first column a narrow card gives up, since the filters name it too.
    meta: { class: { th: 'hidden @4xl:table-cell', ...besideHeading('hidden @4xl:table-cell').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group' || isPart(entry)) return ''
      if (entry.kind === 'split') return h('span', { class: 'text-muted' }, names.value.account(entry.whole.account))
      return entry.row.kind === 'bank'
        ? h('span', { class: 'text-muted' }, names.value.account(entry.row.account))
        : h('span', { class: 'text-muted' }, 'No bank account')
    },
  },
  {
    id: 'amount',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.amount : entry.kind === 'split' ? entry.whole.amount : entry.group.total),
    header: sortableHeader('Amount', true),
    meta: { class: { th: 'text-end', ...besideHeading('text-end').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind === 'split') return h(MoneyText, { cents: entry.whole.amount, class: 'text-muted' })
      return h(MoneyText, { cents: entry.row.amount, tone: 'flow' })
    },
    // The count sits under the counterparty, so the amount column stays as narrow as its figures.
    footer: () =>
      h('span', { class: 'inline-flex items-baseline gap-2 whitespace-nowrap' }, [
        h('span', { class: 'text-xs font-normal text-muted' }, 'Total'),
        h(MoneyText, { cents: total.value, class: 'font-semibold text-highlighted' }),
      ]),
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'sr-only' }, 'Actions'),
    meta: { class: { th: 'w-0 px-0', ...besideHeading('w-0 ps-0 pe-2').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'split') {
        return waitsToMove(entry.whole)
          ? ''
          : h(UButton, {
              icon: 'i-lucide-pencil',
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              'aria-label': `Edit the split of ${entry.whole.counterparty || 'the payment'}`,
              'data-testid': 'edit-split',
              disabled: state.writing,
              onClick: () => openSplit(entry.whole),
            })
      }
      if (entry.kind !== 'row' || entry.row.kind !== 'bank' || entry.row.split !== undefined || entry.row.amount === 0) return ''
      const listed = entry.row
      return h(UButton, {
        icon: 'i-lucide-split',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        'aria-label': `Split the payment of ${listed.counterparty || 'this row'}`,
        'data-testid': 'split-row',
        disabled: state.writing,
        onClick: () => openSplit(listed),
      })
    },
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
          :writing="state.writing"
          :waits-to-move="waitsToMove"
          @toggle="collapsed.toggle"
          @split="openSplit"
        />
        <AppCard v-else as="div" class="@container overflow-hidden">
          <UTable
            v-model:sorting="sorting"
            :data="tableEntries"
            :columns="columns"
            :sorting-options="{ manualSorting: true }"
            :meta="{ class: { tr: (row: EntryCell['row']) => (row.original.kind === 'group' ? 'bg-elevated' : '') } }"
            :get-row-id="(entry: TableEntry) => (entry.kind === 'group' ? `group:${entry.group.key}` : entry.kind === 'split' ? entry.key : entry.row.key)"
            sticky
            class="max-h-[70dvh]"
          />
        </AppCard>
        <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting.row" :split="splitting.split" :categories="ledger.workbook.categories" />
      </template>
    </LedgerGate>
  </section>
</template>
