<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { getGroupedRowModel } from '@tanstack/vue-table'
import type { ExpandedState, GroupingState, SortingState } from '@tanstack/vue-table'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { chartTokens } from '../../charts/chartTokens'
import AppCard from '../AppCard.vue'
import ChartCard from '../ChartCard.vue'
import type { ChartPointSelection } from '../ChartCard.vue'
import ChartLegend from '../ChartLegend.vue'
import DonutCard from '../DonutCard.vue'
import type { DonutPart } from '../DonutCard.vue'
import DrillLink from '../DrillLink.vue'
import KpiTile from '../KpiTile.vue'
import MoneyText from '../MoneyText.vue'
import PageHeader from '../PageHeader.vue'
import PageTabs from '../PageTabs.vue'
import { formatWholeMoney } from '../../money/moneyFormat'
import { civilDate } from '../../calendar/civilDate'
import { anchorWindow } from '../../calendar/ledgerWindow'
import AccountPicker from '../../../features/filters/presentation/AccountPicker.vue'
import FilterChipRow from '../../../features/filters/presentation/FilterChipRow.vue'
import PeriodBar from '../../../features/filters/presentation/PeriodBar.vue'
import type { FilterChip } from '../../../features/filters/domain/filterChips'
import type { Period } from '../../../features/filters/domain/filterState'
import SyncStatus from '../../../features/sync/presentation/SyncStatus.vue'
import type { SyncControl, SyncRun } from '../../../features/sync/domain/syncRun'
import { cashAtMonthEnd, costsByCategory, everyEuroEarned, incomeAgainstCosts, incomeByMonth } from './sampleCharts'
import { SAMPLE_TRANSACTIONS } from './sampleTransactions'
import type { SampleTransaction } from './sampleTransactions'

const tokens = chartTokens()
const transactionsLink = { path: '/transactions' }

const COLOUR_GROUPS = [
  {
    title: 'Surfaces and ink',
    swatches: [
      { name: 'Page', token: '--surface-page' },
      { name: 'Raised', token: '--surface-raised' },
      { name: 'Elevated', token: '--surface-elevated' },
      { name: 'Border', token: '--border-strong' },
      { name: 'Ink strong', token: '--ink-strong' },
      { name: 'Ink', token: '--ink' },
      { name: 'Ink secondary', token: '--ink-secondary' },
      { name: 'Ink muted', token: '--ink-muted' },
    ],
  },
  {
    title: 'Accent and tones',
    swatches: [
      { name: 'Accent', token: '--accent' },
      { name: 'Positive', token: '--tone-positive' },
      { name: 'Negative', token: '--tone-negative' },
      { name: 'Warning', token: '--tone-warning' },
      { name: 'Info', token: '--tone-info' },
    ],
  },
  {
    title: 'Categorical order, with the bucket each slot carries',
    swatches: [
      { name: '1 Income', token: '--series-1' },
      { name: '2 Operating', token: '--series-2' },
      { name: '3 Taxes', token: '--series-3' },
      { name: '4 Owner pay', token: '--series-4' },
      { name: '5 Financing', token: '--series-5' },
      { name: '6', token: '--series-6' },
      { name: '7', token: '--series-7' },
      { name: '8', token: '--series-8' },
      { name: 'Neutral', token: '--bucket-neutral' },
    ],
  },
]

const sampleWindow = anchorWindow(civilDate(2024, 3, 1), civilDate(2026, 10, 14))
const period = ref<Period>({ preset: 'l12' })
const accounts = ref<readonly string[]>([])
const ACCOUNTS = [
  { value: 'main', label: 'Main account' },
  { value: 'card', label: 'Card account' },
  { value: 'savings', label: 'Savings' },
]
const chips = ref<FilterChip[]>([
  { id: 'bucket', label: 'Bucket: operating' },
  { id: 'category', label: 'Category: software-subscriptions' },
  { id: 'counterparty', label: 'Counterparty: Cloud hosting' },
])
function removeChip(id: string): void {
  chips.value = chips.value.filter((chip) => chip.id !== id)
}

const lastSelection = ref<ChartPointSelection | null>(null)

const bucketLegend = [
  { label: 'Income', colour: 'var(--bucket-income)' },
  { label: 'Operating', colour: 'var(--bucket-operating)' },
  { label: 'Taxes', colour: 'var(--bucket-taxes)' },
  { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
  { label: 'Net', colour: 'var(--chart-ink)', mark: 'line' as const },
  { label: 'October so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const },
]

const charts = {
  incomeByMonth: incomeByMonth(tokens),
  incomeAgainstCosts: incomeAgainstCosts(tokens),
  cashAtMonthEnd: cashAtMonthEnd(tokens),
  costsByCategory: costsByCategory(tokens),
  everyEuroEarned: everyEuroEarned(tokens),
}

/** Made-up shares of a year's income, coloured by bucket as every chart colours them. */
const EURO_PARTS: readonly DonutPart[] = [
  { key: 'operating', label: 'Operating', value: 2_412_000, colour: '--bucket-operating', to: transactionsLink },
  { key: 'taxes', label: 'Taxes', value: 1_176_000, colour: '--bucket-taxes', to: transactionsLink },
  { key: 'owner-pay', label: 'Owner pay', value: 2_058_000, colour: '--bucket-owner-pay', to: transactionsLink },
  { key: 'kept', label: 'Kept', value: 2_940_000, colour: '--chart-deemphasis', to: null },
]
const TAX_PARTS: readonly DonutPart[] = [
  { key: 'contributions', label: 'Payroll contributions', value: 486_000, colour: '--series-3', to: transactionsLink },
  { key: 'corporate', label: 'Corporate income tax', value: 412_500, colour: '--series-7', to: transactionsLink },
  { key: 'payroll-tax', label: 'Payroll tax', value: 98_400, colour: '--series-1', to: transactionsLink },
  { key: 'dividend', label: 'Dividend tax', value: 31_000, colour: '--series-5', to: transactionsLink },
]
/** One of each state of the sync control, Allow access also after a closed popup, over a last sync whose statements step filed a statement. */
const SYNC_CONTROLS: readonly SyncControl[] = [
  { kind: 'find' },
  { kind: 'ready', syncedAt: '2026-10-16T06:04:00Z' },
  { kind: 'running', label: 'Statements', position: 2, of: 3, line: 'Filing 3 rows' },
  { kind: 'sign-in', failure: null },
  { kind: 'allow-access', scopes: ['drive.readonly', 'gmail.readonly'], labels: ['Mail', 'Statements'], failure: null },
  { kind: 'allow-access', scopes: ['drive.readonly', 'gmail.readonly'], labels: ['Mail', 'Statements'], failure: "Google's window was closed before access was allowed." },
  { kind: 'problems', count: 1, labels: ['Statements'] },
]

const SYNC_RUN: SyncRun = {
  startedAt: '2026-10-16T06:03:52Z',
  finishedAt: '2026-10-16T06:04:00Z',
  steps: [
    { id: 'books', label: 'Books', scopes: ['drive.file'], state: { kind: 'done', line: 'Up to date', writeId: null, link: null } },
    { id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], state: { kind: 'done', line: 'Nothing new, already there 50', writeId: null, link: null } },
    { id: 'statements', label: 'Statements', scopes: ['drive.readonly'], state: { kind: 'waits', line: 'Filed statement 028, 3 rows. 1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/transactions?tab=import' } } },
  ],
}

const GALLERY_TABS = [
  { value: 'first', label: 'Queue', count: 3 },
  { value: 'second', label: 'Rules' },
  { value: 'third', label: 'History' },
]

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })

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

const tableTotal = SAMPLE_TRANSACTIONS.reduce((total, transaction) => total + transaction.amountCents, 0)

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
      return h('span', { class: 'figure text-muted' }, dateFormat.format(new Date(row.original.date)))
    },
  },
  {
    accessorKey: 'counterparty',
    header: 'Counterparty',
    cell: ({ row }) =>
      row.getIsGrouped()
        ? ''
        : h('div', [
            h(DrillLink, { to: transactionsLink, class: 'text-highlighted' }, () => row.original.counterparty),
            h('div', { class: 'mt-1 @2xl:hidden' }, [sampleCategory(row.original)]),
          ]),
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
        cents: Number(row.getValue('amountCents')),
        ...(row.getIsGrouped() ? {} : { tone: 'flow' as const }),
        class: row.getIsGrouped() ? 'font-medium text-highlighted' : '',
      }),
    footer: () => h(MoneyText, { cents: tableTotal, class: 'font-semibold text-highlighted' }),
  },
]
</script>

<template>
  <div class="flex flex-col gap-12" data-dev-only="DEV-GALLERY-ONLY-DO-NOT-SHIP">
    <PageHeader
      title="Gallery"
      description="Every component and chart style, filled with made-up figures. Only development and fake builds have this page."
    />

    <section class="gallery-section">
      <h2 class="gallery-heading">Colour</h2>
      <div class="flex flex-col gap-6">
        <div v-for="group in COLOUR_GROUPS" :key="group.title">
          <h3 class="mb-2 text-xs text-muted">{{ group.title }}</h3>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
            <li v-for="swatch in group.swatches" :key="swatch.token" class="overflow-hidden rounded-control border border-default bg-raised">
              <span class="block h-10" :style="{ background: `var(${swatch.token})` }" />
              <span class="block px-2 py-1.5 text-xs">
                <span class="block text-highlighted">{{ swatch.name }}</span>
                <span class="identifier block text-dimmed">{{ swatch.token }}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Type</h2>
      <AppCard as="div" class="gap-3 p-5">
        <p class="text-title font-semibold text-highlighted">Period review, 2026 against 2025</p>
        <p class="text-figure-lg font-semibold text-highlighted">€148,210</p>
        <p class="max-w-[65ch] text-sm text-default">
          Body text is Inter at 14 px. Net taxes are taxes paid minus refunds, divided by client revenue for the
          same period, so a refund never flatters the rate.
        </p>
        <p class="text-xs text-muted">Captions and axis labels at 12 px in the muted ink.</p>
        <p class="figure text-sm text-default">Tabular figures: €1,111.11 / €8,888.88 / −€404.04</p>
        <p class="identifier text-toned">HR00 0000 0000 0000 0000 0</p>
      </AppCard>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Period and filters</h2>
      <PeriodBar v-model:period="period" :window="sampleWindow" />
      <AccountPicker v-model="accounts" :options="ACCOUNTS" class="w-fit" />
      <FilterChipRow :chips="chips" one-line @remove="removeChip" @clear="chips = []" />
      <p class="figure text-xs text-muted" aria-live="polite">
        Selected: {{ JSON.stringify(period) }}, {{ accounts.length ? accounts.join(' and ') : 'all accounts' }}
      </p>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Sync status</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="(control, index) in SYNC_CONTROLS" :key="index" class="gallery-frame"><SyncStatus :control="control" :run="SYNC_RUN" /></div>
      </div>
      <h3 class="text-xs text-muted">Compact, as in the phone top bar</h3>
      <div class="flex flex-wrap gap-3">
        <div v-for="(control, index) in SYNC_CONTROLS" :key="index" class="gallery-frame"><SyncStatus :control="control" :run="SYNC_RUN" compact /></div>
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">KPI tiles</h2>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Cash in the bank"
          value="€48,210"
          :to="transactionsLink"
          :delta="{ change: 1, text: '+€1,240', comparison: 'since 30 Sep' }"
          :trend="[31, 33.8, 34.6, 36.2, 38.1, 39.6, 42.1, 43.2, 42.9, 44, 47, 48.2]"
          definition="The closing balance of every account on the newest booking date, added together."
        />
        <KpiTile
          label="Net, last 12 months"
          value="€41,355"
          :to="transactionsLink"
          :delta="{ change: 1, text: '+8.2%', comparison: 'vs the 12 months before' }"
          :trend="[2.6, 3.1, 1.9, 2.2, 3.2, 3.4, 3.9, 3.5, 0.4, 1.4, 3.9, 1.9]"
          definition="Income minus operating costs, taxes and owner pay. Transfers between your own accounts and reimbursements are left out."
        />
        <KpiTile
          label="Costs, monthly average"
          value="€8,690"
          :to="transactionsLink"
          :higher-is-better="false"
          :delta="{ change: 1, text: '+6.1%', comparison: 'vs last 12 months' }"
          :trend="[8.6, 10, 7.9, 8.3, 9.2, 8.5, 9.9, 9.2, 8.7, 7.3, 10.3, 8.7]"
          definition="Operating costs, taxes and owner pay over the last three complete months, divided by three."
        />
        <KpiTile
          label="Needs review"
          value="7 rows"
          :to="transactionsLink"
          :higher-is-better="false"
          :delta="{ change: -1, text: '−4', comparison: 'since the last sync' }"
          definition="Rows guessed by AI, rows with no category, and rows carrying a review reason."
        />
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Cards</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <AppCard title="A card" subtitle="Title, subtitle and actions in the header, the body below." definition="A definition sits behind the info button.">
          <template #actions>
            <UButton label="Add row" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" />
          </template>
          <p class="px-4 pt-3 pb-4 text-sm text-toned sm:px-5">Charts, tiles and short summaries keep their body in view.</p>
        </AppCard>
        <AppCard title="A collapsible card" subtitle="A long list or table. Its toggle is remembered on this device." collapse-id="gallery.sample" summary="3 rows, €1,240 open">
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-for="row in ['September fee', 'October fee', 'Travel to the client']" :key="row" class="border-b border-default py-2 text-sm text-toned last:border-b-0">{{ row }}</li>
          </ul>
        </AppCard>
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Charts</h2>
      <p class="text-xs text-muted" aria-live="polite">
        <template v-if="lastSelection">
          Clicked {{ lastSelection.seriesName }}, {{ lastSelection.category }}. A screen turns this into a filter and opens Transactions.
        </template>
        <template v-else>Click any bar to see the selection a screen receives.</template>
      </p>
      <div class="grid gap-4 xl:grid-cols-2">
        <ChartCard
          class="xl:col-span-2"
          title="Income and costs by month" description="Made-up income and costs by month for the gallery."
          subtitle="Income above zero, costs below it by bucket. October is still running."
          definition="Costs are operating, taxes and owner pay. Financing and transfers between your own accounts never enter these figures."
          :option="charts.incomeAgainstCosts"
          :height="320"
          @select="lastSelection = $event"
        >
          <template #legend><ChartLegend :entries="bucketLegend" /></template>
        </ChartCard>

        <ChartCard
          title="Income by month" description="Made-up income by month for the gallery."
          subtitle="The three-month average leaves out the month in progress."
          :option="charts.incomeByMonth"
          @select="lastSelection = $event"
        >
          <template #legend>
            <ChartLegend
              :entries="[
                { label: 'Income', colour: 'var(--bucket-income)' },
                { label: 'Three-month average', colour: 'var(--chart-ink)', mark: 'line' },
                { label: 'October so far', colour: 'var(--bucket-income)', mark: 'hatched' },
              ]"
            />
          </template>
        </ChartCard>

        <ChartCard title="Cash at month end" description="Made-up month-end cash for the gallery." subtitle="All accounts together" :option="charts.cashAtMonthEnd" />

        <ChartCard
          title="Operating costs by category" description="Made-up operating costs by category for the gallery."
          subtitle="Last 12 months against the 12 before"
          :option="charts.costsByCategory"
          :height="300"
          @select="lastSelection = $event"
        >
          <template #legend>
            <ChartLegend
              :entries="[
                { label: 'Last 12 months', colour: 'var(--bucket-operating)' },
                { label: 'Prior 12 months', colour: 'var(--chart-ghost)', mark: 'ghost' },
              ]"
            />
          </template>
        </ChartCard>

        <ChartCard
          title="Every euro earned" description="Made-up split of every euro earned for the gallery."
          subtitle="Where each euro of income went. Still reads correctly in a loss-making period."
          definition="Each bar is one window. The segments are shares of income in that window and add up to 100%."
          :option="charts.everyEuroEarned"
          :height="180"
          @select="lastSelection = $event"
        >
          <template #legend>
            <ChartLegend
              :entries="[
                { label: 'Kept', colour: 'var(--bucket-income)' },
                { label: 'Operating', colour: 'var(--bucket-operating)' },
                { label: 'Taxes', colour: 'var(--bucket-taxes)' },
                { label: 'Owner pay', colour: 'var(--bucket-owner-pay)' },
              ]"
            />
          </template>
        </ChartCard>

        <ChartCard
          title="A collapsible chart"
          description="Made-up month-end cash for the gallery, in a chart that folds away."
          subtitle="A reference chart a screen opens folded"
          collapse-id="gallery.chart"
          summary="Cash rose in 9 of the last 12 months"
          :option="charts.cashAtMonthEnd"
          :height="200"
        />

        <ChartCard title="Loading" description="A chart while it reloads." subtitle="A refetch keeps the last frame, faded" :option="charts.cashAtMonthEnd" loading :height="200" />
        <ChartCard title="Empty" description="No rows in the period." subtitle="No rows in the period" :option="{}" empty :height="200" />
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Donuts</h2>
      <div class="grid gap-4 xl:grid-cols-2">
        <DonutCard
          title="Every euro earned, last 12 months"
          description="Made-up split of a year's income for the gallery: operating 28%, taxes 14%, owner pay 24%, kept 34%."
          subtitle="Where each euro of income went"
          :parts="EURO_PARTS"
          :total="formatWholeMoney(8_586_000)"
          total-label="income"
        />
        <DonutCard
          title="Tax by type"
          description="Made-up taxes paid in a year for the gallery, by type."
          subtitle="Taxes paid in the year"
          :parts="TAX_PARTS"
          :total="formatWholeMoney(1_027_900)"
          total-label="paid"
          collapse-id="gallery.donut"
          summary="4 kinds of tax, €10,279 paid"
        >
          <template #below>
            <p class="mt-2 text-xs text-muted">Less <span class="figure">{{ formatWholeMoney(64_000) }}</span> refunded, so the year's taxes come to <span class="figure">{{ formatWholeMoney(963_900) }}</span>.</p>
          </template>
        </DonutCard>
      </div>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Page tabs</h2>
      <PageTabs :tabs="GALLERY_TABS" label="Gallery tabs">
        <template #first><p class="text-sm text-toned">The first tab is the default, so it stays out of the address.</p></template>
        <template #second><p class="text-sm text-toned">Picking a tab writes it into the address, so Back steps through tabs.</p></template>
        <template #third><p class="text-sm text-toned">A count shows as a badge, and a screen reader hears it with the label.</p></template>
      </PageTabs>
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Money and drill links</h2>
      <AppCard as="div" class="p-5">
        <div class="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <p class="flex justify-between gap-4"><span class="text-muted">Plain</span><MoneyText :cents="1234567" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Negative</span><MoneyText :cents="-98765" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Money out, as a flow</span><MoneyText :cents="-98765" tone="flow" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Change, sign always</span><MoneyText :cents="31000" sign="always" tone="flow" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">A loss, as an outcome</span><MoneyText :cents="-31000" tone="outcome" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Cost as magnitude</span><MoneyText :cents="-412050" sign="magnitude" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Whole euros</span><MoneyText :cents="4821049" precision="whole" /></p>
          <p class="flex justify-between gap-4"><span class="text-muted">Compact</span><MoneyText :cents="4821049" precision="compact" /></p>
          <p class="flex justify-between gap-4">
            <span class="text-muted">Drill link</span>
            <DrillLink :to="transactionsLink" label="Open the 14 travel transactions"><MoneyText :cents="-391000" sign="magnitude" /></DrillLink>
          </p>
        </div>
      </AppCard>
      <p class="max-w-[65ch] text-sm text-default">
        Travel cost <DrillLink :to="transactionsLink"><MoneyText :cents="391000" /></DrillLink> over the last 12 months, down from
        <DrillLink :to="transactionsLink"><MoneyText :cents="512000" /></DrillLink>. Every figure opens the rows behind it.
      </p>
    </section>

    <section class="gallery-section">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="gallery-heading">Transactions table</h2>
        <USwitch v-model="groupByMonth" label="Group by month" size="sm" />
      </div>
      <p class="text-sm text-muted sm:hidden">The table is the layout from 640 px up. A phone lists the rows as cards.</p>
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
    </section>

    <section class="gallery-section">
      <h2 class="gallery-heading">Empty and error states</h2>
      <div class="grid gap-3 md:grid-cols-2">
        <UEmpty
          icon="i-lucide-search-x"
          title="No transactions match these filters"
          description="Clear a filter or pick a longer period."
          :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline' }]"
          variant="outline"
          class="rounded-card bg-raised"
        />
        <UEmpty
          icon="i-lucide-triangle-alert"
          title="The file on Drive could not be read"
          description="Drive answered 404: File not found. Find the file again or open another."
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline' }]"
          variant="outline"
          class="rounded-card border-error/40 bg-raised"
          :ui="{ avatar: 'text-error' }"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.gallery-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gallery-heading {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink-strong);
}

.gallery-frame {
  min-width: 15rem;
  padding: 1rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  background: var(--surface-raised);
}
</style>
