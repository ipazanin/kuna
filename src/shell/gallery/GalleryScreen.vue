<script setup lang="ts">
import { computed, defineAsyncComponent, h, ref } from 'vue'
import { getGroupedRowModel } from '@tanstack/vue-table'
import type { ExpandedState, GroupingState, SortingState } from '@tanstack/vue-table'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui/components/Table.vue'

import { chartTokens } from '../../shared/charts/chartTokens'
import { formatMoney } from '../../shared/money/moneyFormat'
import type { SyncControl, SyncRun } from '../../shared/sync/application/syncRun'
import SyncStatus from '../../shared/sync/presentation/SyncStatus.vue'
import { intlLocale } from '../../shared/text/language'
import AppCard from '../../shared/ui/AppCard.vue'
import ChartCard from '../../shared/ui/ChartCard.vue'
import type { ChartPointSelection } from '../../shared/ui/ChartCard.vue'
import ChartLegend from '../../shared/ui/ChartLegend.vue'
import ColourSwatchPicker from '../../shared/ui/ColourSwatchPicker.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../shared/ui/DonutCard.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import EmptyState from '../../shared/ui/EmptyState.vue'
import FactGrid from '../../shared/ui/FactGrid.vue'
import type { Fact } from '../../shared/ui/FactGrid.vue'
import FigureTable from '../../shared/ui/FigureTable.vue'
import AppBrand from '../../shared/ui/AppBrand.vue'
import AppMark from '../../shared/ui/AppMark.vue'
import HomeLink from '../../shared/ui/HomeLink.vue'
import InfoPopover from '../../shared/ui/InfoPopover.vue'
import KpiTile from '../../shared/ui/KpiTile.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import PageTabs from '../../shared/ui/PageTabs.vue'
import ProgressMeter from '../../shared/ui/ProgressMeter.vue'
import ScreenSkeleton from '../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../shared/ui/ShowAllButton.vue'
import SortableHeader from '../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../shared/ui/SortableHeader.vue'
import SparkLine from '../../shared/ui/SparkLine.vue'
import { installedApps } from '../routing/appRegistry'
import DialogSpecimens from './DialogSpecimens.vue'
import FormattingGallery from './FormattingGallery.vue'
import FoundationsGallery from './FoundationsGallery.vue'
import GallerySection from './GallerySection.vue'
import { cashAtMonthEnd, costsByCategory, everyEuroEarned, incomeAgainstCosts, incomeByMonth } from './sampleCharts'
import { SAMPLE_TRANSACTIONS } from './sampleTransactions'
import type { SampleTransaction } from './sampleTransactions'
import StepSpecimen from './StepSpecimen.vue'

/**
 * The design library's living page: the foundations, the formatters, and every shared component in
 * each of its states, with made-up figures. Each app adds a part of its own specimens. Only
 * development and fake builds have this page.
 */
const tokens = chartTokens()
const galleryLink = { path: '/gallery', hash: '#kpi-tile' }
const themeLink = (theme: 'light' | 'dark') => `${import.meta.env.BASE_URL}?theme=${theme}#/gallery`

const appSections = installedApps().flatMap((app) => (app.gallery === undefined ? [] : [{ id: app.id, name: app.name, component: defineAsyncComponent(app.gallery) }]))

const CONTENTS = [
  ['colour', 'Colour'],
  ['type', 'Type roles'],
  ['formatting', 'Formatting'],
  ['app-card', 'AppCard'],
  ['kpi-tile', 'KpiTile'],
  ['progress-meter', 'ProgressMeter'],
  ['dashboard-grid', 'DashboardGrid'],
  ['chart-card', 'ChartCard'],
  ['donut-card', 'DonutCard'],
  ['page-tabs', 'PageTabs'],
  ['empty-state', 'EmptyState'],
  ['screen-skeleton', 'ScreenSkeleton'],
  ['form-grid', 'FormGrid'],
  ['dialog', 'AppDialog'],
  ['step-card', 'StepCard'],
  ['figure-table', 'FigureTable'],
  ['grouped-table', 'Grouped table'],
  ['controls', 'Small controls'],
  ['sync-status', 'Sync status'],
] as const

const lastSelection = ref<ChartPointSelection | null>(null)

const BALANCE_POINTS = [180, 176, 171, 167, 154, 148, 140, 131, 121, 110, 97, 83, 67, 49, 29, 0]

const FOUR_FACTS: readonly Fact[] = [
  { label: 'Principal', value: formatMoney(15_427_421), swatch: { colour: 'var(--loan-principal)' } },
  { label: 'Interest', value: formatMoney(7_060_232), swatch: { colour: 'var(--loan-interest)' } },
  { label: 'Subsidy pays', value: formatMoney(105_000), caption: 'Five instalments to go', swatch: { colour: 'var(--chart-deemphasis)', mark: 'hatched' } },
  { label: 'You pay', value: formatMoney(22_382_653) },
]

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
  { key: 'operating', label: 'Operating', value: 2_412_000, colour: '--bucket-operating', to: galleryLink },
  { key: 'taxes', label: 'Taxes', value: 1_176_000, colour: '--bucket-taxes', to: galleryLink },
  { key: 'owner-pay', label: 'Owner pay', value: 2_058_000, colour: '--bucket-owner-pay', to: galleryLink },
  { key: 'kept', label: 'Kept', value: 2_940_000, colour: '--chart-deemphasis', to: null },
]
const TAX_PARTS: readonly DonutPart[] = [
  { key: 'contributions', label: 'Payroll contributions', value: 486_000, colour: '--series-3', to: galleryLink },
  { key: 'corporate', label: 'Corporate income tax', value: 412_500, colour: '--series-7', to: galleryLink },
  { key: 'payroll-tax', label: 'Payroll tax', value: 98_400, colour: '--series-1', to: galleryLink },
  { key: 'dividend', label: 'Dividend tax', value: 31_000, colour: '--series-5', to: galleryLink },
]

/** One of each state of the sync control, Allow access also after a closed popup, over a last sync whose statements step filed a statement. */
const SYNC_CONTROLS: readonly SyncControl[] = [
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
  groups: [
    {
      app: 'company',
      name: 'Company',
      steps: [
        { id: 'books', label: 'Books', scopes: ['drive.file'], state: { kind: 'done', line: 'Up to date', writeId: null, link: null } },
        { id: 'mail', label: 'Mail', scopes: ['gmail.readonly', 'drive.readonly'], state: { kind: 'done', line: 'Nothing new, already there 50', writeId: null, link: null } },
        {
          id: 'statements',
          label: 'Statements',
          scopes: ['drive.readonly'],
          state: { kind: 'waits', line: 'Filed statement 028, 3 rows. 1 statement was not filed.', writeId: null, link: { label: 'Import', to: '/gallery' } },
        },
      ],
    },
  ],
}

const GALLERY_TABS = [
  { value: 'first', label: 'Queue', count: 3 },
  { value: 'second', label: 'Rules' },
  { value: 'third', label: 'History' },
]

const swatchColour = ref('')
const SWATCHES = [1, 2, 3, 4, 5].map((slot) => ({ value: `series-${slot}`, name: `Slot ${slot}`, token: `--series-${slot}` }))

/** A long list for Show all, of made-up payees. */
const PAYEES = Array.from({ length: 14 }, (_, index) => ({ name: `Supplier ${index + 1}`, cents: -(140_000 - index * 8_500) }))
const showAllPayees = ref(false)
const shownPayees = computed(() => (showAllPayees.value ? PAYEES : PAYEES.slice(0, FIRST_SHOWN)))

const amountOrder = ref<SortDirection | null>(null)
const sortedPayees = computed(() => {
  const listed = PAYEES.slice(0, 5)
  if (amountOrder.value === null) return listed
  const sign = amountOrder.value === 'ascending' ? 1 : -1
  return [...listed].sort((first, second) => sign * (first.cents - second.cents))
})
const payeesTotal = PAYEES.slice(0, 5).reduce((total, payee) => total + payee.cents, 0)

const dateFormat = new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' })

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
      description="The design library: its tokens, its formatters and every shared component in each state, filled with made-up figures. Only development and fake builds have this page."
    >
      <template #actions>
        <UButton label="Light" icon="i-lucide-sun" color="neutral" variant="outline" :href="themeLink('light')" />
        <UButton label="Dark" icon="i-lucide-moon" color="neutral" variant="outline" :href="themeLink('dark')" />
      </template>
    </PageHeader>

    <nav aria-label="Parts of the gallery">
      <ul class="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <li v-for="[id, label] in CONTENTS" :key="id">
          <DrillLink :to="{ path: '/gallery', hash: `#${id}` }">{{ label }}</DrillLink>
        </li>
        <li v-for="section in appSections" :key="section.id">
          <DrillLink :to="{ path: '/gallery', hash: `#app-${section.id}` }">{{ section.name }}</DrillLink>
        </li>
      </ul>
    </nav>

    <FoundationsGallery />
    <FormattingGallery />

    <GallerySection id="app-card" title="AppCard" description="The raised card every screen is built from: with a header, with actions and a definition, collapsible, or the bare surface a tile uses.">
      <DashboardGrid>
        <AppCard title="A card" subtitle="Title, subtitle and actions in the header, the body below." definition="A definition sits behind the info button.">
          <template #actions>
            <UButton label="Add row" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" />
          </template>
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">Charts, tiles and short summaries keep their body in view.</p>
        </AppCard>
        <AppCard title="A collapsible card" subtitle="A long list or table. Its toggle is remembered on this device." collapse-id="gallery.sample" summary="3 rows, €1,240 open">
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-for="row in ['September fee', 'October fee', 'Travel to the client']" :key="row" class="border-b border-default py-2 type-body last:border-b-0">{{ row }}</li>
          </ul>
        </AppCard>
        <AppCard as="div" class="gap-2 p-5 xl:col-span-2 3xl:col-span-1">
          <p class="type-card-title">The bare surface</p>
          <p class="type-body">Without a title a card has no header, as a tile has none.</p>
        </AppCard>
        <AppCard
          title="Collapsed from the start"
          subtitle="A reference card a screen opens folded."
          collapse-id="gallery.folded"
          summary="12 rows, €8,690 a month"
          start-collapsed
          class="col-span-full"
        >
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">Its summary line stands in for the body.</p>
        </AppCard>
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="kpi-tile" title="KpiTile and SparkLine" description="A label that opens the rows, a figure, a change against a comparison or a caption, and a trend.">
      <DashboardGrid layout="tiles">
        <KpiTile
          label="Cash in the bank"
          value="€48,210"
          :to="galleryLink"
          :delta="{ change: 1, text: '+€1,240', comparison: 'since 30 Sep' }"
          :trend="[31, 33.8, 34.6, 36.2, 38.1, 39.6, 42.1, 43.2, 42.9, 44, 47, 48.2]"
          definition="The closing balance of every account on the newest booking date, added together."
        />
        <KpiTile
          label="Costs, monthly average"
          value="€8,690"
          :to="galleryLink"
          :higher-is-better="false"
          :delta="{ change: 1, text: '+6.1%', comparison: 'vs last 12 months' }"
          :trend="[8.6, 10, 7.9, 8.3, 9.2, 8.5, 9.9, 9.2, 8.7, 7.3, 10.3, 8.7]"
          definition="Operating costs, taxes and owner pay over the last three complete months, divided by three."
        />
        <KpiTile label="Needs review" value="7 rows" :to="galleryLink" :higher-is-better="false" :delta="{ change: -1, text: '−4', comparison: 'since the last sync' }" />
        <KpiTile label="Next payment" :value="formatMoney(61220)" caption="On 20 Nov, of €822.20" :to="null" />
      </DashboardGrid>
      <div class="flex flex-wrap items-center gap-4 type-caption">
        <SparkLine :points="[2.6, 3.1, 1.9, 2.2, 3.2, 3.4, 3.9, 3.5, 0.4, 1.4, 3.9, 1.9]" />
        <SparkLine :points="[12, 11, 9, 9.5, 8, 6]" :width="120" :height="36" />
        <span>SparkLine at its own size and a larger one</span>
      </div>
      <div class="flex flex-col gap-2 type-caption">
        <SparkLine :points="BALANCE_POINTS" :ahead-from="4" colour="var(--loan-principal)" ahead-colour="var(--loan-ahead)" fill :height="44" />
        <span>Filling its container, solid up to a point and dashed after it in another colour, the dot on the point</span>
        <ChartLegend
          :entries="[
            { label: 'Owed so far', colour: 'var(--loan-principal)', mark: 'line' },
            { label: 'Still to come', colour: 'var(--loan-ahead)', mark: 'dashed' },
          ]"
        />
        <SparkLine :points="[3, 2.5, 1, 1.5, -0.5, -1, 0.5]" colour="var(--loan-principal)" zero-line :width="160" :height="40" />
        <span>With a hairline at zero for a line that crosses it</span>
      </div>
    </GallerySection>

    <GallerySection
      id="progress-meter"
      title="ProgressMeter and FactGrid"
      description="A bar split into parts, striped where someone else pays, read out as one sentence, and labelled figures two to a row or in one."
    >
      <AppCard class="gap-4 p-4 sm:p-5">
        <ProgressMeter
          :parts="[
            { value: 25_725, colour: 'var(--loan-principal)' },
            { value: 154_274, colour: 'var(--loan-ahead)' },
          ]"
          label="14% of €180,000.00 paid back"
        />
        <ProgressMeter
          :parts="[
            { value: 154_274, colour: 'var(--loan-principal)' },
            { value: 1_050, colour: 'var(--loan-interest)', striped: true },
            { value: 69_552, colour: 'var(--loan-interest)' },
          ]"
          label="€154,274.21 principal and €70,602.32 interest, of which the subsidy pays €1,050.00"
          :height="10"
        />
        <FactGrid :facts="FOUR_FACTS" />
        <FactGrid :facts="FOUR_FACTS.slice(0, 3)" class="border-t border-default pt-4" />
      </AppCard>
    </GallerySection>

    <GallerySection
      id="dashboard-grid"
      title="DashboardGrid"
      description="How a dashboard rearranges with the width. Tiles go two to a row, then one row from lg, five or six three to a row and one row from 3xl. Cards go two to a row from xl and three from 3xl. A pair sets two parts side by side from 3xl."
    >
      <h3 class="type-label">Six tiles</h3>
      <DashboardGrid layout="tiles">
        <KpiTile v-for="index in 6" :key="index" :label="`Tile ${index}`" :value="formatMoney(index * 123_400)" :to="null" />
      </DashboardGrid>
      <h3 class="type-label">Three tiles, the odd last one across both on a phone</h3>
      <DashboardGrid layout="tiles">
        <KpiTile v-for="index in 3" :key="index" :label="`Tile ${index}`" :value="formatMoney(index * 51_000)" :to="null" />
      </DashboardGrid>
      <h3 class="type-label">A pair: a long card beside a column of cards</h3>
      <DashboardGrid layout="pair">
        <AppCard title="A long list" subtitle="Beside the column from 3xl, above it below.">
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-for="index in 8" :key="index" class="border-b border-default py-2 type-body last:border-b-0">Row {{ index }}</li>
          </ul>
        </AppCard>
        <DashboardGrid>
          <AppCard title="A wide card" subtitle="Across both columns from xl, one of the column from 3xl." class="xl:col-span-2 3xl:col-span-1">
            <p class="px-4 pt-3 pb-4 type-body sm:px-5">It says so with xl:col-span-2 3xl:col-span-1.</p>
          </AppCard>
          <AppCard title="A card" subtitle="Half the width from xl.">
            <p class="px-4 pt-3 pb-4 type-body sm:px-5">Two to a row.</p>
          </AppCard>
          <AppCard title="Another card" subtitle="Half the width from xl.">
            <p class="px-4 pt-3 pb-4 type-body sm:px-5">Two to a row.</p>
          </AppCard>
        </DashboardGrid>
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="chart-card" title="ChartCard, ChartCanvas and ChartLegend" description="A chart in a card with its legend, its table behind Table, and its loading and empty states.">
      <p class="type-caption" aria-live="polite">
        <template v-if="lastSelection"> Clicked {{ lastSelection.seriesName }}, {{ lastSelection.category }}. A screen turns this into a filter and opens the rows. </template>
        <template v-else>Click any bar to see the selection a screen receives.</template>
      </p>
      <DashboardGrid>
        <ChartCard
          class="xl:col-span-2"
          title="Income and costs by month"
          description="Made-up income and costs by month for the gallery."
          subtitle="Income above zero, costs below it by bucket. October is still running."
          definition="Costs are operating, taxes and owner pay. Financing and transfers between your own accounts never enter these figures."
          :option="charts.incomeAgainstCosts"
          :height="320"
          @select="lastSelection = $event"
        >
          <template #legend><ChartLegend :entries="bucketLegend" /></template>
        </ChartCard>

        <ChartCard
          title="Income by month"
          description="Made-up income by month for the gallery."
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
          title="Operating costs by category"
          description="Made-up operating costs by category for the gallery."
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
          title="Every euro earned"
          description="Made-up split of every euro earned for the gallery."
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
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="donut-card" title="DonutCard" description="One snapshot of at most five parts, the list beside the ring as its table, collapsible, with content below.">
      <DashboardGrid>
        <DonutCard
          title="Every euro earned, last 12 months"
          description="Made-up split of a year's income for the gallery: operating 28%, taxes 14%, owner pay 24%, kept 34%."
          subtitle="Where each euro of income went"
          :parts="EURO_PARTS"
          :total="formatMoney(8_586_000)"
          total-label="income"
        />
        <DonutCard
          title="Tax by type"
          description="Made-up taxes paid in a year for the gallery, by type."
          subtitle="Taxes paid in the year"
          :parts="TAX_PARTS"
          :total="formatMoney(1_027_900)"
          total-label="paid"
          collapse-id="gallery.donut"
          summary="4 kinds of tax, €10,279 paid"
        >
          <template #below>
            <p class="mt-2 type-caption">
              Less <span class="figure">{{ formatMoney(64_000) }}</span> refunded, so the year's taxes come to <span class="figure">{{ formatMoney(963_900) }}</span
              >.
            </p>
          </template>
        </DonutCard>
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="page-tabs" title="PageTabs" description="A screen's inner tabs, written into the address, with a count where something waits.">
      <PageTabs :tabs="GALLERY_TABS" label="Gallery tabs">
        <template #first><p class="type-body">The first tab is the default, so it stays out of the address.</p></template>
        <template #second><p class="type-body">Picking a tab writes it into the address, so Back steps through tabs.</p></template>
        <template #third><p class="type-body">A count shows as a badge, and a screen reader hears it with the label.</p></template>
      </PageTabs>
    </GallerySection>

    <GallerySection id="empty-state" title="EmptyState" description="In place of what a screen has nothing of yet, dashed, or of what could not be worked out, with an error edge.">
      <DashboardGrid>
        <EmptyState
          icon="i-lucide-search-x"
          title="No transactions match these filters"
          description="Clear a filter or pick a longer period."
          :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline' }]"
        />
        <EmptyState
          icon="i-lucide-triangle-alert"
          title="The file on Drive could not be read"
          description="Drive answered 404: File not found. Find the file again or open another."
          :actions="[{ label: 'Try again', color: 'neutral', variant: 'outline' }]"
          tone="error"
        />
        <EmptyState icon="i-lucide-landmark" title="No loans yet" description="Your Loans file is ready. Add a bank loan from its contract, or an informal loan between people." />
        <EmptyState icon="i-lucide-calendar-clock" title="No plan rows yet">
          <template #description>A description with <span class="identifier">code</span> in it comes through its slot.</template>
          <template #actions>
            <UButton label="Add the first row" icon="i-lucide-plus" />
          </template>
        </EmptyState>
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="screen-skeleton" title="ScreenSkeleton" description="Stands in for a screen while its code or its books load, with its heading or below a header that already shows.">
      <ScreenSkeleton :heading="false" :cards="2" />
    </GallerySection>

    <DialogSpecimens />

    <GallerySection id="step-card" title="StepCard" description="One step of a first run, with Back once there is a step before it. Its screen tells it where the run stands.">
      <div class="grid gap-4 lg:grid-cols-2">
        <StepSpecimen start="where" />
        <StepSpecimen start="folder" />
      </div>
    </GallerySection>

    <GallerySection
      id="figure-table"
      title="FigureTable and SortableHeader"
      description="Hairline rows, muted headings, figures on one line. A name may wrap, and a column drops out in a narrow card."
    >
      <AppCard title="Who the company paid most" subtitle="Made-up payees. Sort by the amount, then back to the table's own order.">
        <FigureTable class="px-1 pt-2 pb-2 sm:px-2">
          <thead>
            <tr>
              <th scope="col" class="text-start">Counterparty</th>
              <th scope="col" class="hidden text-start @md:table-cell">Note</th>
              <SortableHeader v-model="amountOrder" label="Paid" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="payee in sortedPayees" :key="payee.name">
              <th scope="row" class="cell-wraps text-start font-normal text-highlighted">{{ payee.name }}</th>
              <td class="hidden text-muted @md:table-cell">Drops out below 28rem</td>
              <td class="text-start"><MoneyText :cents="payee.cents" sign="magnitude" /></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="text-start">Together</th>
              <td class="hidden @md:table-cell" />
              <td class="text-start"><MoneyText :cents="payeesTotal" sign="magnitude" /></td>
            </tr>
          </tfoot>
        </FigureTable>
      </AppCard>
    </GallerySection>

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

    <GallerySection id="controls" title="Small controls" description="InfoPopover, ShowAllButton, ColourSwatchPicker, HomeLink, AppBrand and AppMark.">
      <DashboardGrid>
        <AppCard title="InfoPopover" subtitle="A definition, or richer content such as a legend.">
          <div class="flex items-center gap-2 px-4 pt-3 pb-4 type-body sm:px-5">
            Net taxes
            <InfoPopover subject="net taxes" definition="Taxes paid minus refunds, divided by client revenue for the same period." />
            <InfoPopover subject="the colours">
              <div class="p-3"><ChartLegend :entries="bucketLegend.slice(0, 4)" /></div>
            </InfoPopover>
          </div>
        </AppCard>
        <AppCard title="ColourSwatchPicker" subtitle="Named swatches with a blank choice first.">
          <div class="flex items-center gap-3 px-4 pt-3 pb-4 type-body sm:px-5">
            <ColourSwatchPicker v-model="swatchColour" title="Colour of Software" :blank="{ name: 'The bucket colour', token: '--bucket-operating' }" :swatches="SWATCHES" />
            <span class="identifier">{{ swatchColour || 'blank' }}</span>
          </div>
        </AppCard>
        <AppCard title="ShowAllButton" subtitle="A long list shows its first ten entries." class="xl:col-span-2 3xl:col-span-1">
          <ul class="flex flex-col px-4 pt-2 sm:px-5">
            <li v-for="payee in shownPayees" :key="payee.name" class="flex justify-between border-b border-default py-2 type-body last:border-b-0">
              {{ payee.name }}<MoneyText :cents="payee.cents" sign="magnitude" />
            </li>
          </ul>
          <ShowAllButton v-model:expanded="showAllPayees" :total="PAYEES.length" class="px-4 pt-2 pb-4 sm:px-5" />
        </AppCard>
        <AppCard
          title="HomeLink"
          subtitle="The Kuna mark and name at the top of every app's menu and first run, which opens the home. Its label follows the name for a screen reader."
          class="xl:col-span-2 3xl:col-span-1"
        >
          <div class="px-4 pt-3 pb-4 sm:px-5">
            <HomeLink label="All apps" class="max-w-60" />
          </div>
        </AppCard>
        <AppCard title="AppBrand" subtitle="A name beside the Kuna mark, or beside an app's icon on its tile, as in the phone top bar.">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <AppBrand title="Kuna" />
            <AppBrand title="Overview" icon="i-lucide-landmark" colour="--app-loans" />
          </div>
        </AppCard>
        <AppCard title="AppMark" subtitle="An app's icon on a tile in its own colour, small in a menu and large on the home card.">
          <div class="flex items-center gap-3 px-4 pt-3 pb-4 sm:px-5">
            <AppMark icon="i-lucide-building-2" colour="--app-company" size="large" />
            <AppMark icon="i-lucide-landmark" colour="--app-loans" size="large" />
            <AppMark icon="i-lucide-building-2" colour="--app-company" />
            <AppMark icon="i-lucide-landmark" colour="--app-loans" />
          </div>
        </AppCard>
      </DashboardGrid>
    </GallerySection>

    <GallerySection id="sync-status" title="Sync status" description="Every state of the sync control, in the sidebar and compact in the phone top bar.">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AppCard v-for="(control, index) in SYNC_CONTROLS" :key="index" as="div" class="p-4"><SyncStatus :control="control" :run="SYNC_RUN" /></AppCard>
      </div>
      <h3 class="type-label">Compact, as in the phone top bar</h3>
      <div class="flex flex-wrap gap-3">
        <AppCard v-for="(control, index) in SYNC_CONTROLS" :key="index" as="div" class="p-4"><SyncStatus :control="control" :run="SYNC_RUN" compact /></AppCard>
      </div>
    </GallerySection>

    <GallerySection v-for="section in appSections" :id="`app-${section.id}`" :key="section.id" :title="section.name" :description="`What only the ${section.name} app uses.`">
      <component :is="section.component" />
    </GallerySection>
  </div>
</template>
