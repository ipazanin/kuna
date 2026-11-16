<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { getGroupedRowModel } from '@tanstack/vue-table'
import type { ExpandedState, GroupingState, SortingState } from '@tanstack/vue-table'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { dateFormat } from '../../shared/calendar/dateFormat'
import { moneyFromCents } from '../../shared/money/money'
import AppCard from '../../shared/ui/AppCard.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import GallerySection from './GallerySection.vue'
import { SAMPLE_TRANSACTIONS } from './sampleTransactions'
import type { SampleTransaction } from './sampleTransactions'

const galleryLink = { path: '/gallery', hash: '#kpi-tile' }
const shortDay = dateFormat({ day: 'numeric', month: 'short' })

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

const groupByMonth = ref(true)
const grouping = computed<GroupingState>({
  get: () => (groupByMonth.value ? ['month'] : []),
  set: (columns) => {
    groupByMonth.value = columns.includes('month')
  },
})
const sorting = ref<SortingState>([{ id: 'date', desc: true }])
const expanded = ref<ExpandedState>(true)

const tableTotal = moneyFromCents(SAMPLE_TRANSACTIONS.reduce((total, transaction) => total + transaction.amountCents, 0))

/** As on Transactions, the category moves under the counterparty in a narrow card. */
function sampleCategory(transaction: SampleTransaction) {
  return h('span', { class: 'inline-flex items-center gap-1.5 text-toned' }, [
    h('span', { class: 'size-2 rounded-[2px]', style: { background: `var(--bucket-${transaction.bucket})` }, 'aria-hidden': 'true' }),
    transaction.category,
  ])
}

const columns: TableColumn<SampleTransaction>[] = [
  { accessorKey: 'month', header: 'Month' },
  {
    accessorKey: 'date',
    header: sortableHeader('Date'),
    cell: ({ row }) => {
      if (row.getIsGrouped()) {
        return h('span', { class: 'font-medium text-highlighted' }, `${row.getValue('month')}, ${row.subRows.length} rows`)
      }
      return h('span', { class: 'figure text-muted' }, shortDay(new Date(row.original.date)))
    },
  },
  {
    accessorKey: 'counterparty',
    header: 'Counterparty',
    cell: ({ row }) =>
      row.getIsGrouped()
        ? ''
        : h('div', [h(DrillLink, { to: galleryLink, class: 'text-highlighted' }, () => row.original.counterparty), h('div', { class: 'mt-1 @2xl:hidden' }, [sampleCategory(row.original)])]),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    meta: { class: { th: 'hidden @2xl:table-cell', td: 'hidden @2xl:table-cell' } },
    cell: ({ row }) => (row.getIsGrouped() ? '' : sampleCategory(row.original)),
  },
  {
    accessorKey: 'account',
    header: 'Account',
    meta: { class: { th: 'hidden @4xl:table-cell', td: 'hidden @4xl:table-cell' } },
    cell: ({ row }) => (row.getIsGrouped() ? '' : h('span', { class: 'text-muted' }, row.original.account)),
  },
  {
    accessorKey: 'amountCents',
    header: sortableHeader('Amount', true),
    aggregationFn: 'sum',
    meta: { class: { th: 'text-end', td: 'text-end' } },
    cell: ({ row }) =>
      h(MoneyText, {
        cents: moneyFromCents(Number(row.getValue('amountCents'))),
        ...(row.getIsGrouped() ? {} : { tone: 'flow' as const }),
        class: row.getIsGrouped() ? 'font-medium text-highlighted' : '',
      }),
    footer: () => h(MoneyText, { cents: tableTotal, class: 'font-semibold text-highlighted' }),
  },
]
</script>

<template>
  <GallerySection id="grouped-table" title="Grouped table" description="Nuxt UI's table, themed in vite.config.ts, only where grouping or sorting by a column earns it.">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <USwitch v-model="groupByMonth" label="Group by month" size="sm" />
    </div>
    <p class="type-body sm:hidden">The table is the layout from 640 px up. A phone lists the rows as cards.</p>
    <div class="hidden sm:block">
      <AppCard as="div" class="@container overflow-hidden">
        <UTable
          v-model:sorting="sorting"
          v-model:grouping="grouping"
          v-model:expanded="expanded"
          :data="[...SAMPLE_TRANSACTIONS]"
          :columns="columns"
          :grouping-options="{ groupedColumnMode: 'remove', getGroupedRowModel: getGroupedRowModel() }"
          sticky
          class="max-h-[26rem]"
        />
      </AppCard>
    </div>
  </GallerySection>
</template>
