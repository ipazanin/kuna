<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { yearOf } from '../../../shared/calendar/civilDate'
import { parseMonthKey } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatPercent } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartCard from '../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { TERMS_LINK } from '../../invoicing/presentation/invoicingLinks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { newestBookingOf } from '../../workbook/domain/workbook'
import { BILLING_PLAN_COLUMNS } from '../../workbook/infrastructure/billingPlanTabReader'
import { spreadsheetLink } from '../../workbook/infrastructure/sheetRowLink'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useBillingPlan } from '../application/useBillingPlan'
import { fillRestOfYear } from '../domain/fillRestOfYear'
import BillingMonthList from './BillingMonthList.vue'
import BillingRowDialog from './BillingRowDialog.vue'
import BillingRowList from './BillingRowList.vue'
import { billingYears, billingView } from './billingView'
import type { BillingRowLine } from './billingView'
import { itemColours } from './billingCharts'
import FillYearDialog from './FillYearDialog.vue'

/** What is to be invoiced in a year and what the invoices billed of it, the newest plan rows first. */
const { state } = useWorkbook()
const route = useRoute()
const router = useRouter()

/** The newest booking, which the plan is seen on, as every other screen sees the ledger. */
const asOf = computed(() => newestBookingOf(state.workbook?.transactions ?? []))
const figures = useBillingPlan(asOf)

const years = computed(() => (figures.value === null || asOf.value === null ? [] : billingYears(figures.value, asOf.value)))

/** The year and the opened month live in the address, so a tile's link or a shared link opens the same place. */
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
  return current === null || workbook === null || shown === null ? null : billingView(current, workbook, shown, chartTokens())
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

/** The year on screen, or the year of the newest booking when an earlier one is shown, since only months to come are filled. */
const fillYear = computed(() => (asOf.value === null ? null : Math.max(year.value ?? yearOf(asOf.value), yearOf(asOf.value))))
const fill = computed(() => {
  const workbook = state.workbook
  return workbook === null || asOf.value === null || fillYear.value === null ? null : fillRestOfYear(workbook.billingPlan, workbook.settings.billing, asOf.value, fillYear.value)
})
const fillCount = computed(() => (fill.value?.kind === 'rows' ? fill.value.rows.length : 0))
const fillLabel = computed(() => (asOf.value !== null && fillYear.value === yearOf(asOf.value) ? `Fill the rest of ${fillYear.value}` : `Fill ${fillYear.value}`))

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
  <div class="flex flex-col gap-6">
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
              :label="fillLabel"
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
        <div v-if="years.length > 1" class="flex flex-wrap gap-1.5" role="group" aria-label="Year" data-testid="year-picker">
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

        <div data-testid="billing-year-line">
          <dl class="year-line">
            <div>
              <dt>Planned in {{ year }}</dt>
              <dd><MoneyText :cents="view.yearLine.planned" precision="whole" /></dd>
            </div>
            <div>
              <dt>Invoiced in {{ year }}</dt>
              <dd><MoneyText :cents="view.yearLine.invoiced" precision="whole" /></dd>
            </div>
            <div>
              <dt>Not yet invoiced</dt>
              <dd><MoneyText :cents="view.yearLine.notInvoiced" precision="whole" /></dd>
            </div>
          </dl>
          <p class="mt-1 text-xs text-muted">
            {{ view.yearLine.rowCount }} {{ view.yearLine.rowCount === 1 ? 'plan row' : 'plan rows' }}, {{ view.yearLine.openRowCount }} still open.
            {{ view.yearLine.issuedInYear }} {{ view.yearLine.issuedInYear === 1 ? 'invoice' : 'invoices' }} issued in the year.
          </p>
        </div>

        <div class="wide-pair">
          <AppCard
            id="billing-rows-card"
            :title="`Plan rows, ${year}`"
            collapse-id="invoicing.plan-rows"
            :summary="view.rowsSummary"
            :reveal="route.hash === '#billing-rows-card'"
          >
            <template #subtitle>
              The outgoing-plan tab is the one place for planned revenue, and the forecast reads it. Change a row here or in
              {{ state.workbook?.source === 'google' ? 'the Sheet' : 'an exported file' }}.
            </template>
            <template #actions>
              <UButton label="Add row" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" :disabled="state.writing" data-testid="billing-add" @click="addRow" />
              <UButton
                :label="fillLabel"
                icon="i-lucide-calendar-plus"
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="state.writing"
                data-testid="billing-fill"
                @click="fillDialogOpen = true"
              />
            </template>
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
              No plan row is dated in {{ year }}. <DrillLink :to="TERMS_LINK" in-prose class="text-highlighted">Set the terms</DrillLink> and fill the year, or add a row.
            </p>
            <div v-else class="px-4 pt-2 pb-3 sm:px-5">
              <BillingRowList :rows="view.rows" :show-client="showClient" :editable="!state.writing" @edit="editRow" />
            </div>
          </AppCard>

          <div class="grid gap-4 xl:grid-cols-2 3xl:grid-cols-1 3xl:content-start">
            <AppCard
              id="billing-months-card"
              class="xl:col-span-2 3xl:col-span-1"
              :title="`Month by month, ${year}`"
              subtitle="Each client's invoices bill its rows oldest first: the rows up to the end of the month they were issued in, then, with €1 or more left, the next month's. Open a month for its rows and the invoices that billed them."
              collapse-id="invoicing.months"
              :summary="view.monthsSummary"
              start-collapsed
              :reveal="selectedMonth !== null || route.hash === '#billing-months-card'"
            >
              <p v-if="view.months.length === 0" class="px-5 py-8 text-sm text-muted">No plan row is dated in {{ year }}, and no invoice of it went above the plan.</p>
              <div v-else class="px-4 pt-1 pb-2 sm:px-5">
                <BillingMonthList :months="view.months" :selected="selectedMonth" :show-client="showClient" />
              </div>
            </AppCard>

            <ChartCard
              title="By item"
              subtitle="The year's plan rows by kind, largest first, then what each kind adds up to year by year. An item keeps its colour on every chart and list."
              :option="view.itemsChart.option"
              :description="view.itemsChart.description"
              :height="Math.max(140, view.itemYears * 56 + 56)"
              collapse-id="invoicing.items"
              :summary="view.itemsSummary"
              start-collapsed
              data-testid="billing-items"
            >
              <template #legend>
                <p class="text-xs font-medium text-muted">{{ year }}</p>
                <p v-if="view.items.length === 0" class="py-2 text-sm text-muted">No plan row is dated in {{ year }}.</p>
                <ul v-else class="flex flex-col pb-2">
                  <li v-for="entry in view.items" :key="entry.item" class="item-line">
                    <span class="swatch" :style="{ background: entry.colour }" aria-hidden="true" />
                    <span class="min-w-0 truncate text-sm text-toned">{{ entry.item }}</span>
                    <span class="figure text-xs text-muted">{{ formatPercent(entry.share) }}</span>
                    <MoneyText :cents="entry.amount" class="text-sm text-highlighted" />
                    <span class="share-bar" aria-hidden="true"><span :style="{ width: `${entry.share * 100}%`, background: entry.colour }" /></span>
                  </li>
                </ul>
                <div v-if="references.length > 0" class="border-t border-default py-3">
                  <p class="text-xs font-medium text-muted">
                    Terms on <DrillLink :to="TERMS_LINK" in-prose class="text-toned">the Clients tab</DrillLink>
                  </p>
                  <ul class="mt-1 flex flex-col gap-0.5">
                    <li v-for="entry in references" :key="entry.label" class="flex items-baseline justify-between gap-3 text-xs text-muted">
                      <span class="min-w-0 truncate">{{ entry.label }} as <span class="text-toned">{{ entry.item }}</span>, {{ entry.note }}</span>
                      <MoneyText :cents="entry.amount!" class="text-toned" />
                    </li>
                  </ul>
                </div>
                <p class="border-t border-default pt-3 text-xs font-medium text-muted">Every year</p>
                <ChartLegend :entries="view.itemsChart.legend" class="mt-2" />
              </template>
            </ChartCard>

            <AppCard
              title="Totals over every client"
              subtitle="Every plan row and every invoice. Each year's invoiced amount goes by the invoice's issue date."
              collapse-id="invoicing.totals"
              :summary="view.totalsSummary"
              start-collapsed
              data-testid="billing-check"
            >
              <div class="check-groups max-w-3xl px-4 pt-3 pb-4 sm:px-5">
                <dl class="check-group">
                  <p class="check-heading">All time</p>
                  <div v-for="line in view.check.sums" :key="line.label" class="check-line">
                    <dt>{{ line.label }}</dt>
                    <dd><MoneyText :cents="line.amount" /></dd>
                  </div>
                </dl>
                <dl class="check-group">
                  <p class="check-heading">Invoiced per year</p>
                  <div v-for="line in view.check.actual" :key="line.label" class="check-line">
                    <dt>{{ line.label }}</dt>
                    <dd><MoneyText :cents="line.amount" /></dd>
                  </div>
                </dl>
              </div>
            </AppCard>
          </div>
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
    <FillYearDialog v-if="fill" v-model:open="fillDialogOpen" :fill="fill" :title="fillLabel" :client-name="clientName" :colours="colours" />
  </div>
</template>

<style scoped>
.year-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 2rem;
  row-gap: 0.5rem;
}

.year-line dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.year-line dd {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--ink-strong);
  font-variant-numeric: tabular-nums;
}

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

@media (min-width: 640px) {
  .check-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 2rem;
  }
}
</style>
