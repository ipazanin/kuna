<script setup lang="ts">
import { computed, h } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import CutText from '../../../../shared/ui/CutText.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { words as uiWords } from '../../../../shared/ui/words'
import { plural } from '../../../../shared/text/translation'
import { useFilters } from '../../filters/application/filterStore'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { ShareTarget } from '../../owner-share/domain/ownerShare'
import { ownerPartOrigin } from '../../owner-share/domain/ownerParts'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Transaction } from '../../workbook/domain/workbook'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'
import { categoryChangeOf } from '../domain/categoryChange'
import { listedOwnerPart, partPlace, withPartHeadings } from '../domain/listedRows'
import type { ListedAdvanceRow, ListedBankRow, ListedEntry, ListedRow } from '../domain/listedRows'
import type { TransactionGroup } from '../domain/transactionGroups'
import TransactionGroupHeading from './TransactionGroupHeading.vue'
import { words } from './words'

/** The wide form of the transaction table, with the same rows, groups and actions as the phone's cards. */
const props = defineProps<{
  /** Already in display order. */
  rows: readonly ListedRow[]
  /** Null for one ungrouped list. */
  groups: readonly TransactionGroup[] | null
  total: Money
  bucketLabels: Readonly<Record<DefinedBucket, string>>
  isCollapsed: (key: string) => boolean
  /** The record a row's owner share sits on, or null where none is set here. */
  shareTargetOf: (row: ListedRow) => ShareTarget | null
}>()

const emit = defineEmits<{
  toggle: [key: string]
  split: [row: Transaction]
  changeCategory: [row: ListedBankRow]
  ownerShare: [row: ListedRow]
}>()

const sorting = defineModel<SortingState>('sorting', { required: true })

const { drillLocation } = useFilters()
const names = useDisplayNames()
const colours = useCategoryColours()

/** The table's rows: each group's heading, then its rows unless it is collapsed, a split or shared payment's parts under the payment. */
type TableEntry = { readonly kind: 'group'; readonly group: TransactionGroup } | ListedEntry

const tableEntries = computed<TableEntry[]>(() =>
  props.groups === null
    ? withPartHeadings(props.rows)
    : props.groups.flatMap((group): TableEntry[] => [{ kind: 'group', group }, ...(props.isCollapsed(group.key) ? [] : withPartHeadings(group.rows))]),
)

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
      'aria-label': uiWords.sortBy(label),
      onClick: () => column.toggleSorting(sorted === 'asc'),
    })
  }
}

function narrowTo(narrowing: Parameters<typeof drillToTransactions>[0]) {
  return drillLocation(drillToTransactions(narrowing))
}

type EntryCell = { readonly row: { readonly original: TableEntry } }

const isHeading = (cell: EntryCell): boolean => cell.row.original.kind === 'group'

const isPart = (entry: TableEntry): boolean => entry.kind === 'row' && partPlace(entry.row) !== null

/** The heading's badge: how many parts a split row has, or the share of a shared one. */
function headingBadge(entry: Extract<TableEntry, { kind: 'split' | 'shared' }>) {
  return h(UBadge, { label: entry.kind === 'split' ? plural(words.splitInParts(entry.count), entry.count) : words.sharedWithOwner(entry.share), color: 'neutral', variant: 'subtle', size: 'sm' })
}

/** A group's heading fills its whole row, so every other cell of that row is left out. */
function besideHeading(rowClass = ''): { class: { td: (cell: EntryCell) => string } } {
  return { class: { td: (cell) => (isHeading(cell) ? 'hidden' : rowClass) } }
}

/** Why a row waits for review, beside its category. */
function reviewBadge(listed: ListedRow) {
  if (listed.kind === 'owner-advance') return null
  if (listed.bucket === UNCLASSIFIED) return h(UBadge, { label: words.unclassified, color: 'warning', variant: 'subtle', size: 'sm' })
  if (listed.flaggedBy === 'ai') return h(UBadge, { label: words.noRule, color: 'info', variant: 'subtle', size: 'sm' })
  return null
}

/** The owner's part of a shared row names the share, any VAT it carries and the category it comes from. */
function ownerPartNote(listed: ListedRow) {
  const origin = ownerPartOrigin(listedOwnerPart(listed), names.value.category, (amount) => formatMoney(amount))
  return origin === null ? null : h('span', { class: 'text-xs text-muted' }, origin)
}

function categoryOf(listed: ListedRow) {
  return h('span', { class: 'inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-toned' }, [
    h('span', { class: 'inline-flex items-center gap-1.5' }, [
      h('span', { class: 'size-2 shrink-0 rounded-[2px]', style: { background: colours.value(listed.category, listed.bucket) }, 'aria-hidden': 'true' }),
      listed.category === '' ? h('span', { class: 'text-muted' }, words.noCategory) : h(DrillLink, { to: narrowTo({ categories: [listed.category] }) }, () => names.value.category(listed.category)),
    ]),
    ownerPartNote(listed),
    reviewBadge(listed),
  ])
}

/** A bank row's counterparty opens its rows. An advance has no counterparty in the ledger, so a counterparty filter would leave it out. */
function counterpartyName(row: Transaction | ListedAdvanceRow) {
  return 'kind' in row && row.kind === 'owner-advance'
    ? h('span', { class: 'inline-flex items-center gap-2 text-highlighted' }, [row.counterparty, h(UBadge, { label: words.ownerAdvance, color: 'neutral', variant: 'subtle', size: 'sm' })])
    : h(DrillLink, { to: narrowTo({ counterparties: [counterpartyIdentity(row).key] }), class: 'text-highlighted' }, () => row.counterparty || words.noCounterparty)
}

/** Below a container width the category column drops out and the category moves under the row's name. */
function categoryBelowName(listed: ListedRow) {
  return h('div', { class: 'mt-1 text-sm @2xl:hidden' }, [categoryOf(listed)])
}

/** Split on a payment that is not split yet. A shared payment offers it on its heading, since a split divides the payment as booked. */
function splitButton(payment: Transaction) {
  return payment.amount === 0
    ? null
    : h(UButton, {
        icon: 'i-lucide-split',
        color: 'neutral',
        variant: 'ghost',
        size: 'xs',
        'aria-label': words.splitPayment(payment.counterparty),
        'data-testid': 'split-row',
        onClick: () => emit('split', payment),
      })
}

const columns: TableColumn<TableEntry>[] = [
  {
    id: 'date',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.date : entry.kind === 'group' ? '' : entry.whole.date),
    header: sortableHeader(words.columns.date),
    meta: {
      colspan: { td: (cell: EntryCell) => (isHeading(cell) ? String(COLUMN_COUNT) : '1') },
      class: { td: (cell: EntryCell) => (isHeading(cell) ? 'p-0' : '') },
    },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') {
        return h(TransactionGroupHeading, {
          group: entry.group,
          expanded: !props.isCollapsed(entry.group.key),
          bucketLabels: props.bucketLabels,
          onToggle: () => emit('toggle', entry.group.key),
        })
      }
      if (entry.kind !== 'row') {
        return h('span', { class: 'figure whitespace-nowrap text-muted' }, dayLabel(entry.whole.date))
      }
      return isPart(entry) ? '' : h('span', { class: 'figure whitespace-nowrap text-muted' }, dayLabel(entry.row.date))
    },
  },
  {
    id: 'counterparty',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.counterparty : entry.kind === 'group' ? '' : entry.whole.counterparty),
    header: words.columns.counterparty,
    meta: besideHeading('whitespace-normal'),
    footer: () => h('span', { class: 'text-xs font-normal text-muted' }, plural(words.rows(props.rows.length), props.rows.length)),
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind !== 'row') {
        const { whole } = entry
        return h('div', { class: 'min-w-40 max-w-48 @3xl:max-w-56 @4xl:max-w-96' }, [
          h('span', { class: 'inline-flex flex-wrap items-center gap-2 text-highlighted' }, [counterpartyName(whole), headingBadge(entry)]),
          whole.description === '' ? null : h(CutText, { as: 'p', class: 'text-xs text-muted' }, () => whole.description),
        ])
      }
      const listed = entry.row
      const place = partPlace(listed)
      if (place !== null) {
        const note = listed.kind === 'bank' ? (listed.split?.note ?? '') : ''
        return h('div', { class: 'min-w-40 max-w-48 ps-4 @3xl:max-w-56 @4xl:max-w-96' }, [
          h('span', { class: 'inline-flex items-center gap-1.5 text-toned' }, [
            h(UIcon, { name: 'i-lucide-corner-down-right', class: 'size-3.5 shrink-0 text-muted', 'aria-hidden': 'true' }),
            words.part(place.number, place.count),
          ]),
          note === '' ? null : h(CutText, { as: 'p', class: 'text-xs text-muted' }, () => note),
          categoryBelowName(listed),
        ])
      }
      return h('div', { class: 'min-w-40 max-w-48 @3xl:max-w-56 @4xl:max-w-96' }, [
        counterpartyName(listed),
        listed.description === '' ? null : h(CutText, { as: 'p', class: 'text-xs text-muted' }, () => listed.description),
        categoryBelowName(listed),
      ])
    },
  },
  {
    id: 'category',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.category : ''),
    header: words.columns.category,
    meta: { class: { th: 'hidden @2xl:table-cell', ...besideHeading('hidden whitespace-normal @2xl:table-cell').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind !== 'row') return h('span', { class: 'text-xs text-muted' }, words.countsAsParts)
      return categoryOf(entry.row)
    },
  },
  {
    id: 'account',
    accessorFn: (entry) =>
      entry.kind === 'row' && entry.row.kind === 'bank'
        ? entry.row.account
        : entry.kind === 'split'
          ? entry.whole.account
          : entry.kind === 'shared' && entry.whole.kind === 'bank'
            ? entry.whole.account
            : '',
    header: words.columns.account,
    // The account is the first column a narrow card gives up, since the filters name it too.
    meta: { class: { th: 'hidden @4xl:table-cell', ...besideHeading('hidden @4xl:table-cell').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group' || isPart(entry)) return ''
      if (entry.kind === 'split') return h('span', { class: 'text-muted' }, names.value.account(entry.whole.account))
      const listed = entry.kind === 'shared' ? entry.whole : entry.row
      return h('span', { class: 'text-muted' }, listed.kind === 'bank' ? names.value.account(listed.account) : words.noBankAccount)
    },
  },
  {
    id: 'amount',
    accessorFn: (entry) => (entry.kind === 'row' ? entry.row.amount : entry.kind === 'group' ? entry.group.total : entry.whole.amount),
    header: sortableHeader(words.columns.amount, true),
    meta: { class: { th: 'text-end', ...besideHeading('text-end').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'group') return ''
      if (entry.kind !== 'row') return h(MoneyText, { cents: entry.whole.amount, class: 'text-muted' })
      return h(MoneyText, { cents: entry.row.amount, tone: 'flow' })
    },
    // The count sits under the counterparty, and the total's label goes above it when the card is tight, so the amount column stays as narrow as its figures.
    footer: () =>
      h('span', { class: 'inline-flex flex-wrap items-baseline justify-end gap-x-2' }, [
        h('span', { class: 'text-xs font-normal text-muted' }, words.total),
        h(MoneyText, { cents: props.total, class: 'font-semibold text-highlighted' }),
      ]),
  },
  {
    id: 'actions',
    header: () => h('span', { class: 'sr-only' }, words.columns.actions),
    meta: { class: { th: 'w-0 px-0', ...besideHeading('w-0 ps-0 pe-2').class } },
    cell: ({ row }) => {
      const entry = row.original
      if (entry.kind === 'split') {
        return h(UButton, {
          icon: 'i-lucide-pencil',
          color: 'neutral',
          variant: 'ghost',
          size: 'xs',
          'aria-label': words.editSplit(entry.whole.counterparty),
          'data-testid': 'edit-split',
          onClick: () => emit('split', entry.whole),
        })
      }
      if (entry.kind === 'shared') {
        const { whole } = entry
        return h('span', { class: 'flex justify-end' }, [
          props.shareTargetOf(whole) === null
            ? null
            : h(UButton, {
                icon: 'i-lucide-pencil',
                color: 'neutral',
                variant: 'ghost',
                size: 'xs',
                'aria-label': words.editOwnerShare(whole.counterparty),
                'data-testid': 'edit-owner-share',
                onClick: () => emit('ownerShare', whole),
              }),
          whole.kind === 'bank' ? splitButton(whole) : null,
        ])
      }
      if (entry.kind !== 'row') return ''
      const listed = entry.row
      const place = partPlace(listed)
      const named = place === null ? words.rowName(listed.counterparty) : words.partName(place.number, listed.counterparty)
      return h('span', { class: 'flex justify-end' }, [
        listed.kind !== 'bank' || categoryChangeOf(listed) === null
          ? null
          : h(UButton, {
              icon: 'i-lucide-tag',
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              'aria-label': words.changeCategoryOf(named),
              'data-testid': 'change-category-row',
              onClick: () => emit('changeCategory', listed),
            }),
        listed.kind !== 'bank' || listed.split !== undefined || listed.ownerPart !== undefined ? null : splitButton(listed),
        props.shareTargetOf(listed) === null
          ? null
          : h(UButton, {
              icon: 'i-lucide-hand-coins',
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              'aria-label': words.ownerShareOf(named),
              'data-testid': 'owner-share-row',
              onClick: () => emit('ownerShare', listed),
            }),
      ])
    },
  },
]

const COLUMN_COUNT = columns.length
</script>

<template>
  <AppCard as="div" class="@container overflow-hidden">
    <UTable
      v-model:sorting="sorting"
      :data="tableEntries"
      :columns="columns"
      :sorting-options="{ manualSorting: true }"
      :meta="{ class: { tr: (row: EntryCell['row']) => (row.original.kind === 'group' ? 'bg-elevated' : '') } }"
      :get-row-id="(entry: TableEntry) => (entry.kind === 'group' ? `group:${entry.group.key}` : entry.kind === 'row' ? entry.row.key : entry.key)"
      sticky
      class="max-h-[70dvh]"
    />
  </AppCard>
</template>
