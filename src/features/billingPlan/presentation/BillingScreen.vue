<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { yearOf } from '../../../shared/calendar/civilDate'
import { parseMonthKey, yearOfMonth } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatPercent } from '../../../shared/money/moneyFormat'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import DrillChartCard from '../../filters/presentation/DrillChartCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { newestBookingOf } from '../../workbook/domain/workbook'
import { BILLING_PLAN_COLUMNS } from '../../workbook/infrastructure/billingPlanTabReader'
import { spreadsheetLink } from '../../workbook/infrastructure/sheetRowLink'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useBillingPlan } from '../application/useBillingPlan'
import BillingMonthList from './BillingMonthList.vue'
import BillingRowDialog from './BillingRowDialog.vue'
import BillingRowList from './BillingRowList.vue'
import { billingYears, billingView } from './billingView'
import type { BillingRowLine } from './billingView'
import { itemColours } from './billingCharts'
import FillYearDialog from './FillYearDialog.vue'

const { state } = useWorkbook()
const route = useRoute()
const router = useRouter()

/** The newest booking, which the plan is seen on, as every other screen sees the ledger. */
const asOf = computed(() => newestBookingOf(state.workbook?.transactions ?? []))
const figures = useBillingPlan(asOf)

const years = computed(() => (figures.value === null || asOf.value === null ? [] : billingYears(figures.value, asOf.value)))

/** The year and the opened month live in the address, so a bar's drill or a shared link opens the same place. */
const year = computed(() => {
  const asked = Number(route.query.year)
  return years.value.includes(asked) ? asked : asOf.value === null ? null : yearOf(asOf.value)
})
const selectedMonth = computed((): MonthKey | null => (typeof route.query.month === 'string' ? parseMonthKey(route.query.month) : null))

function pickYear(picked: number): void {
  const { month: _month, ...others } = route.query
  void router.replace({ query: { ...others, year: String(picked) } })
}

const columns = BILLING_PLAN_COLUMNS.join(', ')

const tabState = computed(() => {
  const workbook = state.workbook
  if (workbook === null) return null
  if (workbook.source === 'google' && (state.snapshot?.meta.missingTabs.includes('outgoing-plan') ?? false)) return 'missing' as const
  return workbook.billingPlan.length === 0 ? ('empty' as const) : ('rows' as const)
})

const sheetLink = computed(() => (state.workbook?.source === 'google' ? spreadsheetLink(state.workbook.id) : null))

const view = computed(() => {
  const current = figures.value
  const workbook = state.workbook
  const shown = year.value
  if (current === null || workbook === null || shown === null) return null
  const { month: _month, ...others } = route.query
  const query = { ...others, year: String(shown) }
  return billingView(
    current,
    workbook,
    shown,
    {
      month: (month) => ({ query: { ...query, year: String(yearOfMonth(month)), month }, hash: `#billing-month-${month}` }),
      rows: { query, hash: '#billing-rows-card' },
      months: { query, hash: '#billing-months-card' },
    },
    chartTokens(),
  )
})

const clients = computed(() => state.workbook?.clients ?? [])
const showClient = computed(() => new Set(state.workbook?.billingPlan.map((row) => row.client) ?? []).size > 1)
const terms = computed(() => state.workbook?.settings.billing ?? null)
const clientName = computed(() => {
  const slug = terms.value?.client ?? ''
  return clients.value.find((client) => client.slug === slug)?.name || slug
})

/** Every item the plan uses, largest first, then the items the terms name. */
const knownItems = computed(() => {
  const used = figures.value?.statistics.items.map((total) => total.item) ?? []
  const named = [terms.value?.monthlyItem, terms.value?.subscriptionItem, terms.value?.bonusItem].filter((item): item is string => item !== undefined && item !== '')
  return [...new Set([...used, ...named])]
})
const colours = computed(() => itemColours(figures.value?.statistics.items.map((total) => total.item) ?? [], chartTokens()))

const fillYear = computed(() => (asOf.value === null ? null : yearOf(asOf.value)))
const fillCount = computed(() => (figures.value?.fill.kind === 'rows' ? figures.value.fill.rows.length : 0))

const editing = ref<BillingRowLine | null>(null)
const rowDialogOpen = ref(false)
const fillDialogOpen = ref(false)

function addRow(): void {
  editing.value = null
  rowDialogOpen.value = true
}

function editRow(row: BillingRowLine): void {
  editing.value = row
  rowDialogOpen.value = true
}

const references = computed(() => {
  const billing = terms.value
  if (billing === null) return []
  return [
    { label: 'Monthly fee', item: billing.monthlyItem, amount: billing.monthlyAmount, note: 'filled for every month' },
    { label: 'Monthly subscriptions', item: billing.subscriptionItem, amount: billing.subscriptionAmount, note: 'filled for every month' },
    { label: 'Yearly bonus', item: billing.bonusItem, amount: billing.bonusAmount, note: 'for reference, never filled' },
  ].filter((entry) => entry.amount !== null)
})

const problems = computed(() => state.workbook?.problems.filter((problem) => problem.tab === 'outgoing-plan') ?? [])
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Billing plan" description="What is to be invoiced, month by month, against what the invoices billed of it.">
      <template v-if="tabState === 'rows' && years.length > 1" #actions>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Year" data-testid="year-picker">
          <UButton
            v-for="entry in years"
            :key="entry"
            :label="String(entry)"
            size="sm"
            color="neutral"
            :variant="entry === year ? 'solid' : 'outline'"
            :aria-pressed="entry === year"
            @click="pickYear(entry)"
          />
        </div>
      </template>
    </PageHeader>
    <LedgerGate>
      <UEmpty
        v-if="tabState === 'missing'"
        icon="i-lucide-calendar-clock"
        title="The Sheet has no outgoing-plan tab yet"
        variant="outline"
        class="rounded-card border-dashed bg-raised/40"
        :actions="sheetLink ? [{ label: 'Open the Sheet', icon: 'i-lucide-external-link', color: 'neutral', variant: 'outline', to: sheetLink, target: '_blank' }] : []"
        data-testid="billing-no-tab"
      >
        <template #description>
          <span class="block max-w-[60ch]">
            The billing plan is one row per item to invoice a client, such as a month's fee, a bonus or a re-billed hotel, dated on the day it becomes
            billable. Add a tab named <span class="identifier">outgoing-plan</span> with these headers in row 1, then sync:
            <span class="identifier">{{ columns }}</span>. The client is its name on the clients tab.
          </span>
        </template>
      </UEmpty>
      <UEmpty
        v-else-if="tabState === 'empty'"
        icon="i-lucide-calendar-clock"
        title="No plan rows yet"
        variant="outline"
        class="rounded-card border-dashed bg-raised/40"
        data-testid="billing-empty"
      >
        <template #description>
          <span class="block max-w-[60ch]">
            The billing plan is one row per item to invoice a client, such as a month's fee, a bonus or a re-billed hotel, dated on the day it becomes
            billable. It lives on the <span class="identifier">outgoing-plan</span> tab, with the columns <span class="identifier">{{ columns }}</span>. Each
            invoice then bills the rows it reaches, oldest first.
          </span>
        </template>
        <template #actions>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton label="Add the first row" icon="i-lucide-plus" :disabled="state.writing" data-testid="billing-start" @click="addRow" />
            <UButton
              v-if="fillCount > 0"
              :label="`Fill the rest of ${fillYear}`"
              icon="i-lucide-calendar-plus"
              color="neutral"
              variant="outline"
              :disabled="state.writing"
              @click="fillDialogOpen = true"
            />
          </div>
        </template>
      </UEmpty>
      <template v-else-if="view && figures">
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="billing-tiles">
          <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
        </div>

        <div class="wide-pair">
          <div class="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] 3xl:grid-cols-1 3xl:content-start">
            <DrillChartCard
              :chart="view.chart"
              :title="`Planned against invoiced, ${year}`"
              subtitle="Each month's plan rows, and what the invoices billed of them. A bar opens its month below."
              definition="Invoiced counts what invoices billed of the rows dated in the month, whenever they were issued. What an invoice billed with no plan row it could reach sits hatched on top, in the month it was issued."
              :empty="view.chartEmpty"
              :height="300"
              :phone-height="240"
            >
              <template #legend><ChartLegend :entries="view.chart.legend" /></template>
            </DrillChartCard>

            <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="billing-check-title" data-testid="billing-check">
              <header class="px-4 pt-4 sm:px-5">
                <h2 id="billing-check-title" class="text-sm font-medium text-highlighted">Sums, planned and actual</h2>
                <p class="mt-0.5 text-xs text-muted">Over every client, as the Sheet's formula block beside the plan rows adds them. Planned goes by the row's date, actual by the invoice's issue date.</p>
              </header>
              <div class="check-groups px-4 pt-3 pb-4 sm:px-5">
                <dl class="check-group">
                  <p class="check-heading">Sums</p>
                  <div v-for="line in view.check.sums" :key="line.label" class="check-line">
                    <dt>{{ line.label }}</dt>
                    <dd><MoneyText :cents="line.amount" /></dd>
                  </div>
                </dl>
                <dl class="check-group">
                  <p class="check-heading">Planned per year</p>
                  <div v-for="line in view.check.planned" :key="line.label" class="check-line">
                    <dt>{{ line.label }}</dt>
                    <dd><MoneyText :cents="line.amount" /></dd>
                  </div>
                </dl>
                <dl class="check-group">
                  <p class="check-heading">Actual per year</p>
                  <div v-for="line in view.check.actual" :key="line.label" class="check-line">
                    <dt>{{ line.label }}</dt>
                    <dd><MoneyText :cents="line.amount" /></dd>
                  </div>
                </dl>
              </div>
            </section>
          </div>

          <section id="billing-months-card" class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="billing-months-title">
            <header class="px-4 pt-4 sm:px-5">
              <h2 id="billing-months-title" class="text-sm font-medium text-highlighted">Month by month, {{ year }}</h2>
              <p class="mt-0.5 text-xs text-muted">
                Each client's invoices bill its rows oldest first, and reach rows dated up to the end of the month after the one they were issued in. Open a month
                for its rows and the invoices that billed them.
              </p>
            </header>
            <p v-if="view.months.length === 0" class="px-5 py-8 text-sm text-muted">No plan row is dated in {{ year }}, and no invoice of it went beyond the plan.</p>
            <div v-else class="px-4 pt-1 pb-2 sm:px-5">
              <BillingMonthList :months="view.months" :selected="selectedMonth" :show-client="showClient" />
            </div>
          </section>
        </div>

        <div class="wide-pair">
          <div class="grid gap-4 xl:grid-cols-2 3xl:grid-cols-1 3xl:content-start">
            <ChartCard
              title="By item, every year"
              subtitle="What each kind of item adds up to, year by year. An item keeps its colour on every chart and list."
              :option="view.itemsChart.option"
              :description="view.itemsChart.description"
              :height="Math.max(140, view.itemYears * 56 + 56)"
            >
              <template #legend><ChartLegend :entries="view.itemsChart.legend" /></template>
            </ChartCard>

            <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="billing-items-title" data-testid="billing-items">
              <header class="px-4 pt-4 sm:px-5">
                <h2 id="billing-items-title" class="text-sm font-medium text-highlighted">By item, {{ year }}</h2>
                <p class="mt-0.5 text-xs text-muted">The year's plan rows by kind, largest first.</p>
              </header>
              <p v-if="view.items.length === 0" class="px-5 py-8 text-sm text-muted">No plan row is dated in {{ year }}.</p>
              <ul v-else class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
                <li v-for="entry in view.items" :key="entry.item" class="item-line">
                  <span class="swatch" :style="{ background: entry.colour }" aria-hidden="true" />
                  <span class="min-w-0 truncate text-sm text-toned">{{ entry.item }}</span>
                  <span class="figure text-xs text-muted">{{ formatPercent(entry.share) }}</span>
                  <MoneyText :cents="entry.amount" class="text-sm text-highlighted" />
                  <span class="share-bar" aria-hidden="true"><span :style="{ width: `${entry.share * 100}%`, background: entry.colour }" /></span>
                </li>
              </ul>
              <div v-if="references.length > 0" class="border-t border-default px-4 py-3 sm:px-5">
                <p class="text-xs font-medium text-muted">Terms on Workbook, General</p>
                <ul class="mt-1 flex flex-col gap-0.5">
                  <li v-for="entry in references" :key="entry.label" class="flex items-baseline justify-between gap-3 text-xs text-muted">
                    <span class="min-w-0 truncate">{{ entry.label }} as <span class="text-toned">{{ entry.item }}</span>, {{ entry.note }}</span>
                    <MoneyText :cents="entry.amount!" class="text-toned" />
                  </li>
                </ul>
              </div>
            </section>
          </div>

          <section id="billing-rows-card" class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="billing-rows-title">
            <header class="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
              <div class="min-w-0">
                <h2 id="billing-rows-title" class="text-sm font-medium text-highlighted">Plan rows, {{ year }}</h2>
                <p class="mt-0.5 text-xs text-muted">
                  The outgoing-plan tab is the one place for planned revenue, and the forecast reads it. Change a row here or in
                  {{ state.workbook?.source === 'google' ? 'the Sheet' : 'an exported file' }}.
                </p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton label="Add row" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="billing-add" @click="addRow" />
                <UButton
                  :label="`Fill the rest of ${fillYear}`"
                  icon="i-lucide-calendar-plus"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="state.writing"
                  data-testid="billing-fill"
                  @click="fillDialogOpen = true"
                />
              </div>
            </header>
            <div v-if="problems.length > 0" class="flex items-start gap-2 px-4 pt-3 text-sm text-toned sm:px-5" data-testid="billing-problems">
              <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />
              <div class="min-w-0">
                <p>{{ problems.length === 1 ? 'One row of the tab is' : `${problems.length} rows of the tab are` }} left out until it is fixed:</p>
                <ul class="text-xs text-muted">
                  <li v-for="problem in problems" :key="problem.sheetRow">Row {{ problem.sheetRow }}: {{ problem.reason }}</li>
                </ul>
              </div>
            </div>
            <p v-if="view.rows.length === 0" class="px-5 py-8 text-sm text-muted">
              No plan row is dated in {{ year }}. <DrillLink to="/workbook" in-prose class="text-highlighted">Set the terms</DrillLink> and fill the year, or add a row.
            </p>
            <div v-else class="px-4 pt-2 pb-3 sm:px-5">
              <BillingRowList :rows="view.rows" :show-client="showClient" :editable="!state.writing" @edit="editRow" />
            </div>
          </section>
        </div>
      </template>
    </LedgerGate>

    <BillingRowDialog
      v-if="asOf"
      v-model:open="rowDialogOpen"
      :row="editing"
      :items="knownItems"
      :clients="clients"
      :default-date="asOf"
      :default-client="terms?.client ?? ''"
    />
    <FillYearDialog v-if="figures" v-model:open="fillDialogOpen" :fill="figures.fill" :client-name="clientName" :colours="colours" />
  </section>
</template>

<style scoped>
.check-groups {
  display: grid;
  gap: 1rem;
}

.check-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.check-heading {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--ink-muted);
}

.check-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.check-line dt {
  color: var(--ink);
}

.check-line dd {
  color: var(--ink-strong);
  font-variant-numeric: tabular-nums;
}

.check-line + .check-line {
  border-top: 1px solid var(--border-default);
  padding-top: 0.25rem;
}

.item-line {
  display: grid;
  grid-template-columns: 0.625rem minmax(0, 1fr) auto auto;
  grid-template-areas:
    'swatch name share amount'
    '. bar bar bar';
  align-items: center;
  column-gap: 0.625rem;
  row-gap: 0.25rem;
  padding: 0.375rem 0;
}

.item-line .swatch {
  grid-area: swatch;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 2px;
}

.item-line .share-bar {
  grid-area: bar;
  height: 4px;
  border-radius: 2px;
  background: var(--chart-ghost);
  overflow: hidden;
}

.item-line .share-bar > span {
  display: block;
  height: 100%;
  border-radius: 2px;
}

@media (min-width: 640px) and (max-width: 1279px) {
  .check-groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
