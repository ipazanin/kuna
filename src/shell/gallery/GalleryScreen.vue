<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { formatMoney } from '../../shared/money/moneyFormat'
import AppCard from '../../shared/ui/AppCard.vue'
import ChartLegend from '../../shared/ui/ChartLegend.vue'
import ChoiceButtons from '../../shared/ui/ChoiceButtons.vue'
import MenuButton from '../../shared/ui/MenuButton.vue'
import ColourSwatchPicker from '../../shared/ui/ColourSwatchPicker.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../shared/ui/DrillLink.vue'
import GettingSetUpCard from '../../shared/ui/GettingSetUpCard.vue'
import FactGrid from '../../shared/ui/FactGrid.vue'
import type { Fact } from '../../shared/ui/FactGrid.vue'
import FigureTable from '../../shared/ui/FigureTable.vue'
import FileDrop from '../../shared/ui/FileDrop.vue'
import FilterChipRow from '../../shared/ui/FilterChipRow.vue'
import FiltersSheet from '../../shared/ui/FiltersSheet.vue'
import AskChatButton from '../../shared/ai/presentation/AskChatButton.vue'
import AppBrand from '../../shared/ui/AppBrand.vue'
import AppMark from '../../shared/ui/AppMark.vue'
import HomeLink from '../../shared/ui/HomeLink.vue'
import InfoPopover from '../../shared/ui/InfoPopover.vue'
import KpiTile from '../../shared/ui/KpiTile.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import PageTabs from '../../shared/ui/PageTabs.vue'
import WriteProgress from '../../shared/ui/WriteProgress.vue'
import ProgressMeter from '../../shared/ui/ProgressMeter.vue'
import RemovableChip from '../../shared/ui/RemovableChip.vue'
import ScreenSkeleton from '../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../shared/ui/ShowAllButton.vue'
import SortableHeader from '../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../shared/ui/SortableHeader.vue'
import SparkLine from '../../shared/ui/SparkLine.vue'
import { installedApps } from '../routing/appRegistry'
import BankNameFieldSpecimen from './BankNameFieldSpecimen.vue'
import TableRecipeEditorSpecimen from './TableRecipeEditorSpecimen.vue'
import ChangeListSpecimens from './ChangeListSpecimens.vue'
import ChartSpecimens from './ChartSpecimens.vue'
import ChatElementSpecimens from './ChatElementSpecimens.vue'
import CutTextSpecimens from './CutTextSpecimens.vue'
import DialogSpecimens from './DialogSpecimens.vue'
import EmptyStateSpecimens from './EmptyStateSpecimens.vue'
import FormattingGallery from './FormattingGallery.vue'
import FoundationsGallery from './FoundationsGallery.vue'
import GallerySection from './GallerySection.vue'
import GroupedTableSpecimen from './GroupedTableSpecimen.vue'
import MoveButtonsSpecimen from './MoveButtonsSpecimen.vue'
import PeriodBarSpecimens from './PeriodBarSpecimens.vue'
import QuestionListSpecimens from './QuestionListSpecimens.vue'
import RowSpecimens from './RowSpecimens.vue'
import ScenarioSpecimens from './ScenarioSpecimens.vue'
import SplitEditorSpecimens from './SplitEditorSpecimens.vue'
import { BUCKET_LEGEND } from './sampleCharts'
import StepSpecimen from './StepSpecimen.vue'
import SyncStatusSpecimens from './SyncStatusSpecimens.vue'
import { moneyFromCents, sumMoney } from '../../shared/money/money'

/**
 * The design library's living page: the foundations, the formatters, and every shared component in
 * each of its states, with made-up figures. Each app adds a part of its own specimens. Only
 * development and fake builds have this page.
 */
const galleryLink = { path: '/gallery', hash: '#kpi-tile' }
const themeLink = (theme: 'light' | 'dark') => `${import.meta.env.BASE_URL}?theme=${theme}#/gallery`

const appSections = installedApps().flatMap((app) => (app.gallery === undefined ? [] : [{ id: app.id, name: app.name, component: defineAsyncComponent(app.gallery) }]))

const CONTENTS = [
  ['colour', 'Colour'],
  ['type', 'Type roles'],
  ['formatting', 'Formatting'],
  ['app-card', 'AppCard'],
  ['change-list-card', 'ChangeListCard'],
  ['kpi-tile', 'KpiTile'],
  ['progress-meter', 'ProgressMeter'],
  ['dashboard-grid', 'DashboardGrid'],
  ['chart-card', 'ChartCard'],
  ['donut-card', 'DonutCard'],
  ['page-tabs', 'PageTabs'],
  ['empty-state', 'EmptyState'],
  ['getting-set-up-card', 'GettingSetUpCard'],
  ['screen-skeleton', 'ScreenSkeleton'],
  ['form-grid', 'FormGrid'],
  ['dialog', 'AppDialog'],
  ['split-editor', 'SplitEditor'],
  ['step-card', 'StepCard'],
  ['figure-table', 'FigureTable'],
  ['scenario-comparison', 'ScenarioComparison'],
  ['grouped-table', 'Grouped table'],
  ['controls', 'Small controls'],
  ['cut-text', 'CutText'],
  ['sync-status', 'Sync status'],
  ['write-progress', 'WriteProgress'],
] as const

const BALANCE_POINTS = [180, 176, 171, 167, 154, 148, 140, 131, 121, 110, 97, 83, 67, 49, 29, 0]

const FOUR_FACTS: readonly Fact[] = [
  { label: 'Principal', value: formatMoney(moneyFromCents(15_427_421)), swatch: { colour: 'var(--loan-principal)' } },
  { label: 'Interest', value: formatMoney(moneyFromCents(7_060_232)), swatch: { colour: 'var(--loan-interest)' } },
  { label: 'Subsidy pays', value: formatMoney(moneyFromCents(105_000)), caption: 'Five instalments to go', swatch: { colour: 'var(--chart-deemphasis)', mark: 'hatched' } },
  { label: 'You pay', value: formatMoney(moneyFromCents(22_382_653)) },
]

/** Facts whose values are keys rather than figures, drawn through the value slot. */
const KEY_FACTS: Fact[] = [
  { label: 'Counterparty IBAN', value: 'HR1210010051863000160' },
  { label: 'Reference', value: 'HR00 2026-0314' },
]

/** Facts that are one amount each: money out and in through an account in the soft depth, and a debt forgiven in ink with its sign. */
const AMOUNT_FACTS: readonly Fact[] = [
  { label: 'Next payment', amount: { cents: moneyFromCents(-81_240), tone: 'flow' }, caption: 'For the whole loan, 20 Nov', note: 'Your part 406.20' },
  { label: 'Last movement', amount: { cents: moneyFromCents(50_000), tone: 'flow' }, caption: 'Repaid on 3 Oct' },
  { label: 'Forgiven', amount: { cents: moneyFromCents(-100_000), sign: 'always' }, caption: '24 Dec' },
]

/** Labels that are a Croatian form's own field names, read in Croatian whatever the screen's language. */
const FORM_FACTS: readonly Fact[] = [
  { label: '11 Primitak', value: formatMoney(moneyFromCents(21_584)), caption: 'A reading', lang: 'hr' },
  { label: '14.1 Porez', value: formatMoney(moneyFromCents(1_630)), caption: 'Settled', lang: 'hr' },
]

const GALLERY_TABS = [
  { value: 'first', label: 'Queue', count: 3 },
  { value: 'second', label: 'Rules' },
  { value: 'third', label: 'History' },
]

const swatchColour = ref('')
const ownSwatchColour = ref('#7a3e12')
const alikeSwatchColour = ref('#2a78d6')
const GALLERY_PERIODS = [
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: 'all', label: 'All' },
] as const
const galleryPeriod = ref<(typeof GALLERY_PERIODS)[number]['value']>('all')

const GALLERY_RECEIPT_WAYS = [
  { value: 'type', label: 'Type it in', icon: 'i-lucide-keyboard' },
  { value: 'photo', label: 'Read the photo', icon: 'i-lucide-camera', description: 'Opens the camera on a phone' },
] as const
const galleryReceiptWay = ref<(typeof GALLERY_RECEIPT_WAYS)[number]['value'] | null>(null)
const GALLERY_LAYOUTS = [
  { value: 'expanded', label: 'Expanded', icon: 'i-lucide-panel-left', description: 'Shows as icons while the chat needs the room' },
  { value: 'icons', label: 'Icons', icon: 'i-lucide-panel-left-close' },
  { value: 'hidden', label: 'Hidden', icon: 'i-lucide-panel-left-dashed' },
] as const
const galleryLayout = ref<(typeof GALLERY_LAYOUTS)[number]['value']>('expanded')
const GALLERY_SHADES = [
  { value: 'pale', label: 'Pale', icon: 'i-lucide-sun' },
  { value: 'deep', label: 'Deep', icon: 'i-lucide-moon' },
] as const
const GALLERY_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large', description: 'Loads the page again' },
] as const
const galleryShade = ref<(typeof GALLERY_SHADES)[number]['value']>('pale')
const gallerySize = ref<(typeof GALLERY_SIZES)[number]['value']>('small')
const galleryGroups = computed(() => [
  { label: 'Shade', choices: GALLERY_SHADES, picked: galleryShade.value },
  { label: 'Size', choices: GALLERY_SIZES, picked: gallerySize.value },
])
function pickGalleryLook(value: (typeof GALLERY_SHADES)[number]['value'] | (typeof GALLERY_SIZES)[number]['value']): void {
  if (value === 'pale' || value === 'deep') galleryShade.value = value
  else gallerySize.value = value
}
const GALLERY_CHIPS = ['EXQ', 'Category: Software subscriptions', 'Counterparty: A supplier whose name runs far past the width of a chip']
const galleryChips = ref<readonly string[]>(GALLERY_CHIPS)
const galleryFilterChips = computed(() => galleryChips.value.map((chip) => ({ id: chip, label: chip })))

/** A long list for Show all, of made-up payees. */
const PAYEES = Array.from({ length: 14 }, (_, index) => ({ name: `Supplier ${index + 1}`, cents: moneyFromCents(-(140_000 - index * 8_500)) }))
const showAllPayees = ref(false)
const droppedFile = ref<File | null>(null)
const droppedName = ref('')
const droppedFiles = ref<File[] | null>(null)
const shownPayees = computed(() => (showAllPayees.value ? PAYEES : PAYEES.slice(0, FIRST_SHOWN)))

const amountOrder = ref<SortDirection | null>(null)
const sortedPayees = computed(() => {
  const listed = PAYEES.slice(0, 5)
  if (amountOrder.value === null) return listed
  const sign = amountOrder.value === 'ascending' ? 1 : -1
  return [...listed].sort((first, second) => sign * (first.cents - second.cents))
})
const payeesTotal = sumMoney(PAYEES.slice(0, 5).map((payee) => payee.cents))
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
      <ul class="flex flex-wrap gap-x-4 gap-y-2">
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
        <AppCard as="div" class="gap-2 p-5 @max-8xl:basis-full">
          <p class="type-card-title">The bare surface</p>
          <p class="type-body">Without a title a card has no header, as a tile has none.</p>
        </AppCard>
        <AppCard title="Collapsed from the start" subtitle="A reference card a screen opens folded." collapse-id="gallery.folded" summary="12 rows, €8,690 a month" start-collapsed class="basis-full">
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">Its summary line stands in for the body.</p>
        </AppCard>
      </DashboardGrid>
    </GallerySection>
    <ChangeListSpecimens />

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
        <KpiTile label="Next payment" :value="formatMoney(moneyFromCents(61220))" caption="On 20 Nov, of €822.20" :to="null" />
      </DashboardGrid>
      <DashboardGrid layout="tiles">
        <KpiTile label="Failed checks" value="2" caption="since the last run" icon="i-lucide-circle-x" icon-tone="error" :to="null" />
        <KpiTile label="Passed checks" value="41" caption="since the last run" icon="i-lucide-circle-check" icon-tone="success" :to="null" />
        <KpiTile label="Accounts" value="3" caption="An icon in no tone, beside a link" icon="i-lucide-landmark" :to="galleryLink" />
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
      description="A bar split into parts, striped where someone else pays, read out as one sentence, and labelled figures two to a row or in one, with a form's own field names marked Croatian and an amount in the look of its kind."
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
        <FactGrid :facts="FORM_FACTS" class="border-t border-default pt-4" />
        <FactGrid :facts="AMOUNT_FACTS" class="border-t border-default pt-4" data-testid="gallery-amount-facts" />
        <FactGrid :facts="KEY_FACTS" class="border-t border-default pt-4">
          <template #value="{ fact }">
            <span class="identifier break-all type-body">{{ fact.value }}</span>
          </template>
        </FactGrid>
      </AppCard>
    </GallerySection>

    <ChartSpecimens />

    <GallerySection id="page-tabs" title="PageTabs" description="A screen's inner tabs, written into the address, with a count where something waits.">
      <PageTabs :tabs="GALLERY_TABS" label="Gallery tabs">
        <template #first><p class="type-body">The first tab is the default, so it stays out of the address.</p></template>
        <template #second><p class="type-body">Picking a tab writes it into the address, so Back steps through tabs.</p></template>
        <template #third><p class="type-body">A count shows as a badge, and a screen reader hears it with the label.</p></template>
      </PageTabs>
    </GallerySection>

    <GallerySection
      id="getting-set-up-card"
      title="GettingSetUpCard"
      description="What an app still lacks, with the screen that does each line. An action can settle a line where it stands, and the header's actions what settles several, such as Set up with the chat."
    >
      <GettingSetUpCard
        :lines="[
          { key: 'first-statement', text: 'Import your first bank statement', link: { label: 'Import', to: '/gallery' } },
          { key: 'first-rules', text: 'Kuna filed 31 of 48 rows. Teach it your biggest payees: Alpha Hosting, Beta Telecom and Gamma Rent.', link: { label: 'To review', to: '/gallery' } },
        ]"
      >
        <template #action="{ line }">
          <UButton v-if="line.key === 'first-statement'" label="Not now" color="neutral" variant="outline" size="sm" class="shrink-0" />
        </template>
        <template #actions><AskChatButton text="Set up with the chat" /></template>
      </GettingSetUpCard>
    </GallerySection>

    <EmptyStateSpecimens />

    <GallerySection id="screen-skeleton" title="ScreenSkeleton" description="Stands in for a screen while its code or its books load, with its heading or below a header that already shows.">
      <ScreenSkeleton :heading="false" :cards="2" />
    </GallerySection>

    <DialogSpecimens />

    <SplitEditorSpecimens />

    <GallerySection id="step-card" title="StepCard" description="One step of a first run, with Back once there is a step before it. Its screen tells it where the run stands.">
      <div class="grid gap-4 @2xl:grid-cols-2">
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
              <SortableHeader v-model="amountOrder" label="Paid" align="end" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="payee in sortedPayees" :key="payee.name">
              <th scope="row" class="cell-wraps text-start font-normal text-highlighted">{{ payee.name }}</th>
              <td class="hidden text-muted @md:table-cell">Drops out below 28rem</td>
              <td class="text-end"><MoneyText :cents="payee.cents" sign="magnitude" /></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" class="text-start">Together</th>
              <td class="hidden @md:table-cell" />
              <td class="text-end"><MoneyText :cents="payeesTotal" sign="magnitude" /></td>
            </tr>
          </tfoot>
        </FigureTable>
      </AppCard>
    </GallerySection>

    <ScenarioSpecimens />

    <GroupedTableSpecimen />

    <ChatElementSpecimens />

    <GallerySection
      id="controls"
      title="Small controls"
      description="InfoPopover, ChoiceButtons, MenuButton, MoveButtons, RemovableChip, FilterChipRow, FiltersSheet, ShowAllButton, ColourSwatchPicker, HomeLink, AppBrand and AppMark."
    >
      <DashboardGrid>
        <AppCard title="InfoPopover" subtitle="A definition, or richer content such as a legend.">
          <div class="flex items-center gap-2 px-4 pt-3 pb-4 type-body sm:px-5">
            Net taxes
            <InfoPopover subject="net taxes" definition="Taxes paid minus refunds, divided by client revenue for the same period." />
            <InfoPopover subject="the colours">
              <div class="p-3"><ChartLegend :entries="BUCKET_LEGEND.slice(0, 4)" /></div>
            </InfoPopover>
          </div>
        </AppCard>
        <AppCard title="ChoiceButtons" subtitle="One of a few choices, the picked one solid and pressed.">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <ChoiceButtons v-model="galleryPeriod" :options="GALLERY_PERIODS" label="Period" />
            <span class="identifier">{{ galleryPeriod }}</span>
          </div>
        </AppCard>
        <AppCard
          title="MenuButton"
          subtitle="One button for a few ways to do one thing, or for a setting with one choice in force, which the menu checks. Groups put several settings in one menu, each under its label with one checked. The icon look names itself in a tooltip."
        >
          <div class="flex flex-wrap items-center gap-3 px-4 pt-3 pb-4 sm:px-5">
            <MenuButton label="Add a receipt" icon="i-lucide-receipt" :choices="GALLERY_RECEIPT_WAYS" data-testid="gallery-menu-button" @pick="galleryReceiptWay = $event" />
            <span class="identifier">{{ galleryReceiptWay ?? 'Nothing picked yet' }}</span>
            <MenuButton
              label="Sidebar layout"
              icon="i-lucide-panel-left"
              look="icon"
              :choices="GALLERY_LAYOUTS"
              :picked="galleryLayout"
              data-testid="gallery-menu-button-picked"
              @pick="galleryLayout = $event"
            />
            <span class="identifier">{{ galleryLayout }}</span>
            <MenuButton
              :label="`Look: ${galleryShade}, ${gallerySize}`"
              :icon="galleryShade === 'pale' ? 'i-lucide-sun' : 'i-lucide-moon'"
              look="icon"
              :groups="galleryGroups"
              data-testid="gallery-menu-button-groups"
              @pick="pickGalleryLook"
            />
            <span class="identifier">{{ galleryShade }}, {{ gallerySize }}</span>
          </div>
        </AppCard>
        <MoveButtonsSpecimen />
        <AppCard title="RemovableChip" subtitle="Names something picked, such as a filter or a ticker to compare with. A press anywhere on it removes it.">
          <div class="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-4 sm:px-5">
            <RemovableChip v-for="chip in galleryChips" :key="chip" :label="chip" :remove-label="`Remove ${chip}`" @remove="galleryChips = galleryChips.filter((shown) => shown !== chip)" />
            <RemovableChip label="receipt.jpg" remove-label="Remove receipt.jpg" icon="i-lucide-image" />
            <RemovableChip label="statement.pdf" remove-label="Remove statement.pdf" icon="i-lucide-file-text" />
            <RemovableChip label="scan.pdf" remove-label="Remove scan.pdf" icon="i-lucide-file" loading />
            <UButton v-if="galleryChips.length < GALLERY_CHIPS.length" label="Put them back" color="neutral" variant="link" size="xs" @click="galleryChips = GALLERY_CHIPS" />
          </div>
        </AppCard>
        <AppCard title="FilterChipRow" subtitle="The filters on as chips with Clear. In one line, the chips that do not fit fold into +N more, as the narrow first row shows.">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <FilterChipRow :chips="galleryFilterChips" one-line class="max-w-64" @remove="galleryChips = galleryChips.filter((shown) => shown !== $event)" @clear="galleryChips = []" />
            <FilterChipRow :chips="galleryFilterChips" @remove="galleryChips = galleryChips.filter((shown) => shown !== $event)" @clear="galleryChips = []" />
            <UButton v-if="galleryChips.length < GALLERY_CHIPS.length" label="Put them back" color="neutral" variant="link" size="xs" class="self-start" @click="galleryChips = GALLERY_CHIPS" />
          </div>
        </AppCard>
        <AppCard
          title="FiltersSheet"
          subtitle="A phone's Filters button, with the count of filters on, opening a sheet of the filters. Inside a page's tabs it moves to the tab row. Press one to see the sheet open."
        >
          <div class="flex flex-wrap items-center gap-3 px-4 pt-3 pb-4 sm:px-5">
            <FiltersSheet :active-count="0" show-label="Show results">
              <p class="type-body">No filter is on.</p>
            </FiltersSheet>
            <FiltersSheet :active-count="galleryChips.length" show-label="Show results">
              <div class="flex flex-wrap gap-1.5">
                <RemovableChip v-for="chip in galleryChips" :key="chip" :label="chip" :remove-label="`Remove ${chip}`" @remove="galleryChips = galleryChips.filter((shown) => shown !== chip)" />
              </div>
            </FiltersSheet>
          </div>
        </AppCard>
        <AppCard title="ColourSwatchPicker" subtitle="The palette with a blank choice first, and Other colour below, which refuses a code too pale for the light theme.">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 type-body sm:px-5">
            <div class="flex items-center gap-3">
              <ColourSwatchPicker v-model="swatchColour" title="Colour of Software" :blank="{ name: 'The bucket colour', token: '--bucket-operating' }" />
              <span class="identifier">{{ swatchColour || 'blank' }}</span>
            </div>
            <div class="flex items-center gap-3" data-testid="gallery-own-colour">
              <ColourSwatchPicker v-model="ownSwatchColour" title="Colour of Hardware" :blank="{ name: 'The bucket colour', token: '--bucket-operating' }" note="An own colour." />
              <span class="identifier">{{ ownSwatchColour || 'blank' }}</span>
            </div>
            <div class="flex items-center gap-3" data-testid="gallery-alike-colour">
              <ColourSwatchPicker
                v-model="alikeSwatchColour"
                title="Colour of Travel"
                :blank="{ name: 'The bucket colour', token: '--bucket-operating' }"
                warning="Hard to tell apart from Software subscriptions on a chart."
              />
              <span class="identifier">{{ alikeSwatchColour || 'blank' }}</span>
            </div>
          </div>
        </AppCard>
        <AppCard title="ShowAllButton" subtitle="A long list shows its first ten entries." class="@max-8xl:basis-full">
          <ul class="flex flex-col px-4 pt-2 sm:px-5">
            <li v-for="payee in shownPayees" :key="payee.name" class="flex justify-between border-b border-default py-2 type-body last:border-b-0">
              {{ payee.name }}<MoneyText :cents="payee.cents" sign="magnitude" />
            </li>
          </ul>
          <ShowAllButton v-model:expanded="showAllPayees" :total="PAYEES.length" class="px-4 pt-2 pb-4 sm:px-5" />
        </AppCard>
        <AppCard
          title="HomeLink"
          subtitle="The Kuna mark and name, which open the home. The standard look opens every menu, the quiet one every first run. Its label is the link's name for a screen reader."
          class="@max-8xl:basis-full"
        >
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <HomeLink label="Kuna, Home" look="standard" class="max-w-60" />
            <HomeLink label="Kuna, Home" look="quiet" class="max-w-60" />
          </div>
        </AppCard>
        <AppCard
          title="AppBrand"
          subtitle="A name beside the Kuna mark, or beside an app's icon on its tile, as in the phone top bar. Standard at the top of a menu, quiet in the link home of a first run."
        >
          <div class="flex flex-col items-start gap-3 px-4 pt-3 pb-4 sm:px-5">
            <AppBrand title="Kuna" />
            <AppBrand title="Kuna" look="quiet" />
            <AppBrand title="Kuna" look="rail" />
            <AppBrand title="Overview" icon="i-lucide-landmark" colour="--app-loans" />
          </div>
        </AppCard>
        <AppCard title="AppMark" subtitle="An app's icon on a tile in its own colour: large on the home card, small on an app's row in the menu.">
          <div class="flex items-center gap-3 px-4 pt-3 pb-4 sm:px-5">
            <AppMark icon="i-lucide-building-2" colour="--app-company" size="large" />
            <AppMark icon="i-lucide-landmark" colour="--app-loans" size="large" />
            <AppMark icon="i-lucide-building-2" colour="--app-company" />
            <AppMark icon="i-lucide-landmark" colour="--app-loans" />
          </div>
        </AppCard>
      </DashboardGrid>
    </GallerySection>

    <QuestionListSpecimens />

    <RowSpecimens />

    <CutTextSpecimens />

    <GallerySection id="file-drop" title="FileDrop" description="A dashed place to drop a file on, or to tap to choose one. The caller reads the file and says what it found.">
      <AppCard as="div" class="flex flex-col gap-3 p-4 sm:p-5">
        <FileDrop v-model="droppedFile" accept=".xlsx,.csv" label="Drop a statement file here" description="or click to choose one" @update:model-value="droppedName = $event?.name ?? droppedName" />
        <FileDrop
          v-model="droppedFile"
          accept=".xlsx,.csv"
          icon="i-lucide-file-spreadsheet"
          label="Drop a workbook here"
          description="or click to choose one"
          @update:model-value="droppedName = $event?.name ?? droppedName"
        />
        <FileDrop v-model="droppedFiles" multiple accept=".csv" icon="i-lucide-files" label="Drop several CSV files here" description="or click to choose them, one or many" />
        <span class="identifier">{{ droppedName || 'No file yet' }}</span>
        <span class="identifier">{{ droppedFiles === null || droppedFiles.length === 0 ? 'No files yet' : droppedFiles.map((file) => file.name).join(', ') }}</span>
      </AppCard>
    </GallerySection>

    <SyncStatusSpecimens />

    <BankNameFieldSpecimen />
    <TableRecipeEditorSpecimen />

    <PeriodBarSpecimens />

    <GallerySection id="write-progress" title="WriteProgress" description="The bar along the top of the page while a write to the books runs, shown here in place.">
      <AppCard as="div" class="p-4"><WriteProgress active label="Saving" /></AppCard>
    </GallerySection>

    <GallerySection v-for="section in appSections" :id="`app-${section.id}`" :key="section.id" :title="section.name" :description="`What only the ${section.name} app uses.`">
      <component :is="section.component" />
    </GallerySection>
  </div>
</template>
