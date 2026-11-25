<script setup lang="ts">
import { computed, ref } from 'vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate } from '../../shared/calendar/civilDate'
import { rangeWindow } from '../../shared/charts/chartRange'
import type { ChartPreset, ChartRange } from '../../shared/charts/chartRange'
import type { ChartRangeChoice } from '../../shared/charts/useChartRange'
import { chartTokens } from '../../shared/charts/chartTokens'
import { moneyFromCents } from '../../shared/money/money'
import { formatMoney, formatPercent } from '../../shared/money/moneyFormat'
import AppCard from '../../shared/ui/AppCard.vue'
import ChartCard from '../../shared/ui/ChartCard.vue'
import type { ChartPointSelection } from '../../shared/ui/ChartCard.vue'
import ChartLegend from '../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../shared/ui/DonutCard.vue'
import KpiTile from '../../shared/ui/KpiTile.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import GallerySection from './GallerySection.vue'
import { BUCKET_LEGEND, cashAtMonthEnd, costsByCategory, everyEuroEarned, incomeAgainstCosts, incomeByMonth, SAMPLE_HOLDINGS, valueMap } from './sampleCharts'

const tokens = chartTokens()
const galleryLink = { path: '/gallery', hash: '#kpi-tile' }

const lastSelection = ref<ChartPointSelection | null>(null)

const charts = {
  incomeByMonth: incomeByMonth(tokens),
  incomeAgainstCosts: incomeAgainstCosts(tokens),
  cashAtMonthEnd: cashAtMonthEnd(tokens),
  costsByCategory: costsByCategory(tokens),
  everyEuroEarned: everyEuroEarned(tokens),
  valueMap: valueMap(tokens),
}

const gainLegend = [
  { label: 'Loss over 25%', colour: 'var(--loss-3)', mark: 'tile' as const },
  { label: 'Loss of 10 to 25%', colour: 'var(--loss-2)', mark: 'tile' as const },
  { label: 'Loss up to 10%', colour: 'var(--loss-1)', mark: 'tile' as const },
  { label: 'Gain up to 10%', colour: 'var(--gain-1)', mark: 'tile' as const },
  { label: 'Gain of 10 to 25%', colour: 'var(--gain-2)', mark: 'tile' as const },
  { label: 'Gain over 25%', colour: 'var(--gain-3)', mark: 'tile' as const },
]

/** Made-up shares of a year's income, coloured by bucket as every chart colours them. */
const EURO_PARTS: readonly DonutPart[] = [
  { key: 'operating', label: 'Operating', value: moneyFromCents(2_908_487), colour: '--bucket-operating', to: galleryLink },
  { key: 'taxes', label: 'Taxes', value: moneyFromCents(1_454_243), colour: '--bucket-taxes', to: galleryLink },
  { key: 'owner-pay', label: 'Owner pay', value: moneyFromCents(2_492_988), colour: '--bucket-owner-pay', to: galleryLink },
  { key: 'kept', label: 'Kept', value: moneyFromCents(3_531_734), colour: '--chart-deemphasis', to: null, caption: 'A caption line under its row, such as what the figure includes' },
]
const TAX_PARTS: readonly DonutPart[] = [
  { key: 'contributions', label: 'Payroll contributions', value: moneyFromCents(486_000), colour: '--series-3', to: galleryLink },
  { key: 'corporate', label: 'Corporate income tax', value: moneyFromCents(412_500), colour: '--series-7', to: galleryLink },
  { key: 'payroll-tax', label: 'Payroll tax', value: moneyFromCents(98_400), colour: '--series-1', to: galleryLink },
  { key: 'dividend', label: 'Dividend tax', value: moneyFromCents(31_000), colour: '--series-5', to: galleryLink },
]
/** Made-up sectors, an open list: the four largest in size order, the rest grey. */
const SECTOR_PARTS: readonly DonutPart[] = [
  { key: 'technology', label: 'Information technology', value: moneyFromCents(700_000), colour: '--series-1', to: null },
  { key: 'industrials', label: 'Industrials', value: moneyFromCents(200_000), colour: '--series-2', to: null },
  { key: 'financials', label: 'Financials', value: moneyFromCents(60_000), colour: '--series-3', to: null },
  { key: 'health-care', label: 'Health care', value: moneyFromCents(40_000), colour: '--series-4', to: null },
  { key: 'other', label: 'Other and not known', value: moneyFromCents(35_000), colour: '--chart-deemphasis', to: null },
]
const REGION_PARTS: readonly DonutPart[] = [
  { key: 'north-america', label: 'North America', value: moneyFromCents(640_000), colour: '--series-1', to: null },
  { key: 'europe', label: 'Europe', value: moneyFromCents(250_000), colour: '--series-2', to: null },
  { key: 'asia-pacific', label: 'Asia and Pacific', value: moneyFromCents(100_000), colour: '--series-3', to: null },
  { key: 'other', label: 'Other and not known', value: moneyFromCents(45_000), colour: '--chart-deemphasis', to: null },
]
const OPEN_SPLITS = [
  { value: 'sector', label: 'By sector' },
  { value: 'region', label: 'By region' },
]
const openSplit = ref('sector')

const GALLERY_TODAY = parseCivilDate('2026-10-31')!
const GALLERY_SPAN = { from: parseCivilDate('2022-01-31')!, to: parseCivilDate('2032-01-31')! }
const GALLERY_RANGES: ChartPreset[] = ['1y', '3y', 'next-5y', 'all']
/** Opens on a custom span, so its from and to days show. */
const galleryRange = ref<ChartRange>({ from: parseCivilDate('2025-04-01')!, to: GALLERY_TODAY })
const galleryChoice: ChartRangeChoice = {
  ranges: computed(() => GALLERY_RANGES),
  range: computed({ get: () => galleryRange.value, set: (picked) => (galleryRange.value = picked) }),
  window: computed(() => rangeWindow(galleryRange.value, GALLERY_TODAY)),
  span: computed(() => GALLERY_SPAN),
}
</script>

<template>
  <GallerySection
    id="dashboard-grid"
    title="DashboardGrid"
    description="How a dashboard rearranges with the room it has, which the chat's dock takes from. Tiles go two to a row, then one row from @4xl, five or six three to a row from @3xl and one row from @8xl. Cards go two to a row from @4xl and three from @8xl. The parts of a row share it, so a card with no partner spans its row. A pair sets two parts side by side from @8xl. A row of up to four cards is under ScenarioComparison."
  >
    <h3 class="type-label">Six tiles</h3>
    <DashboardGrid layout="tiles">
      <KpiTile v-for="index in 6" :key="index" :label="`Tile ${index}`" :value="formatMoney(moneyFromCents(index * 123_400))" :to="null" />
    </DashboardGrid>
    <h3 class="type-label">Three tiles, the odd last one across both on a phone</h3>
    <DashboardGrid layout="tiles">
      <KpiTile v-for="index in 3" :key="index" :label="`Tile ${index}`" :value="formatMoney(moneyFromCents(index * 51_000))" :to="null" />
    </DashboardGrid>
    <h3 class="type-label">Five tiles, three and then two that share their row</h3>
    <DashboardGrid layout="tiles" data-testid="gallery-grid-five-tiles">
      <KpiTile v-for="index in 5" :key="index" :label="`Tile ${index}`" :value="formatMoney(moneyFromCents(index * 87_600))" :to="null" />
    </DashboardGrid>
    <h3 class="type-label">Three cards, the last one across its row while two fit to a row</h3>
    <DashboardGrid data-testid="gallery-grid-lone-card">
      <AppCard v-for="index in 3" :key="index" :title="`Card ${index}`" subtitle="Two to a row from @4xl and three from @8xl.">
        <p class="px-4 pt-3 pb-4 type-body sm:px-5">A card with no partner in its row spans it.</p>
      </AppCard>
    </DashboardGrid>
    <h3 class="type-label">A pair: a long card beside a column of cards</h3>
    <DashboardGrid layout="pair">
      <AppCard title="A long list" subtitle="Beside the column from @8xl, above it below.">
        <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
          <li v-for="index in 8" :key="index" class="border-b border-default py-2 type-body last:border-b-0">Row {{ index }}</li>
        </ul>
      </AppCard>
      <DashboardGrid>
        <AppCard title="A wide card" subtitle="Across the row once two fit, a part of the row once three do." class="@max-8xl:basis-full">
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">It says so with @max-8xl:basis-full.</p>
        </AppCard>
        <AppCard title="A card" subtitle="Half the width from @4xl.">
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">Two to a row.</p>
        </AppCard>
        <AppCard title="Another card" subtitle="Half the width from @4xl.">
          <p class="px-4 pt-3 pb-4 type-body sm:px-5">Two to a row.</p>
        </AppCard>
      </DashboardGrid>
    </DashboardGrid>
  </GallerySection>

  <GallerySection
    id="chart-card"
    title="ChartCard, ChartCanvas and ChartLegend"
    description="A chart in a card with its legend, its table behind Table, a treemap that brings its own table, and its loading and empty states."
  >
    <p class="type-caption" aria-live="polite">
      <template v-if="lastSelection"> Clicked {{ lastSelection.seriesName }}, {{ lastSelection.category }}. A screen turns this into a filter and opens the rows. </template>
      <template v-else>Click any bar to see the selection a screen receives.</template>
    </p>
    <DashboardGrid>
      <ChartCard
        class="basis-full"
        title="Income and costs by month"
        description="Made-up income and costs by month for the gallery."
        subtitle="Income above zero, costs below it by bucket. October is still running."
        definition="Costs are operating, taxes and owner pay. Financing and transfers between your own accounts never enter these figures."
        :option="charts.incomeAgainstCosts"
        :height="320"
        @select="lastSelection = $event"
      >
        <template #legend><ChartLegend :entries="BUCKET_LEGEND" /></template>
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

      <ChartCard
        :range-choice="galleryChoice"
        title="Cash at month end"
        description="Made-up month-end cash for the gallery."
        subtitle="All accounts together, with the span it shows picked beside the legend or typed as a from and a to day"
        :option="charts.cashAtMonthEnd"
      >
        <template #legend>
          <ChartLegend
            :entries="[
              { label: 'Cash', colour: 'var(--series-3)', mark: 'line' },
              { label: 'A deposit', colour: 'var(--invest-buy)', mark: 'dot' },
              { label: 'A withdrawal', colour: 'var(--invest-sale)', mark: 'dot' },
              { label: 'A new rate', colour: 'var(--loan-interest)', mark: 'ring' },
            ]"
          />
        </template>
      </ChartCard>

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
        title="Value by holding"
        description="Made-up holdings for the gallery, each sized by its value and tinted by its gain or loss."
        subtitle="A chart with no category axis brings its own table"
        :option="charts.valueMap"
        :height="300"
        @select="lastSelection = $event"
      >
        <template #legend><ChartLegend :entries="gainLegend" /></template>
        <template #table>
          <caption class="sr-only">
            Value by holding
          </caption>
          <thead>
            <tr>
              <th scope="col" class="text-start">Holding</th>
              <th scope="col" class="text-end">Value</th>
              <th scope="col" class="text-end">Gain</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="holding in SAMPLE_HOLDINGS" :key="holding.name">
              <th scope="row" class="text-start font-normal text-toned">{{ holding.name }}</th>
              <td class="text-end"><MoneyText :cents="holding.value" /></td>
              <td class="figure text-end">{{ formatPercent(holding.gain, 'always') }}</td>
            </tr>
          </tbody>
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

  <GallerySection
    id="donut-card"
    title="DonutCard"
    description="One snapshot of at most five parts, the list beside the ring as its table with a line under a row, collapsible, with content below, and an open list coloured by size with a select in its header."
  >
    <DashboardGrid>
      <DonutCard
        title="Every euro earned, last 12 months"
        description="Made-up split of a year's income for the gallery: operating 28%, taxes 14%, owner pay 24%, kept 34%."
        subtitle="Where each euro of income went"
        :parts="EURO_PARTS"
        :total="formatMoney(moneyFromCents(10_387_452))"
        total-label="income"
      />
      <DonutCard
        title="Tax by type"
        description="Made-up taxes paid in a year for the gallery, by type."
        subtitle="Taxes paid in the year"
        :parts="TAX_PARTS"
        :total="formatMoney(moneyFromCents(1_027_900))"
        total-label="paid"
        collapse-id="gallery.donut"
        :summary="`4 kinds of tax, ${formatMoney(moneyFromCents(1_027_900))} paid`"
      >
        <template #below>
          <p class="mt-2 type-caption">
            Less <span class="figure">{{ formatMoney(moneyFromCents(64_000)) }}</span> refunded, so the year's taxes come to <span class="figure">{{ formatMoney(moneyFromCents(963_900)) }}</span
            >.
          </p>
        </template>
      </DonutCard>
      <DonutCard
        title="Mix"
        :description="
          openSplit === 'sector'
            ? 'Made-up holdings by sector for the gallery: information technology 68%, industrials 19%, financials 6%, health care 4%, other and not known 3%.'
            : 'Made-up holdings by region for the gallery: North America 62%, Europe 24%, Asia and Pacific 10%, other and not known 4%.'
        "
        subtitle="An open list, its four largest in size order and the rest grey, picked in the header"
        :parts="openSplit === 'sector' ? SECTOR_PARTS : REGION_PARTS"
        :total="formatMoney(moneyFromCents(1_035_000))"
        total-label="of holdings"
      >
        <template #actions>
          <USelect v-model="openSplit" :items="OPEN_SPLITS" size="sm" aria-label="Split the value" class="w-36" />
        </template>
      </DonutCard>
    </DashboardGrid>
  </GallerySection>
</template>
