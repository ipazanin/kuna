<script setup lang="ts">
import { computed } from 'vue'

import { monthLabel } from '../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import { drillToTransactions } from '../../../features/filters/domain/drillTarget'
import { periodInWords } from '../../../features/filters/domain/periodInWords'
import DrillChartCard from '../../../features/filters/presentation/DrillChartCard.vue'
import FilterBar from '../../../features/filters/presentation/FilterBar.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import LedgerGate from '../../../features/workbook/presentation/LedgerGate.vue'
import { effectiveTaxRate } from '../domain/effectiveTaxRate'
import { ownerCost } from '../domain/ownerCost'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import { payrollCadence } from '../domain/payrollCadence'
import { taxByType } from '../domain/taxByType'
import CadenceCalendar from './CadenceCalendar.vue'
import MissingRoles from './MissingRoles.vue'
import OwnerPayOff from './OwnerPayOff.vue'
import { categoryLegend, categorySeries, taxByTypeChart } from './packCharts'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const RATE_DEFINITION =
  'Taxes paid less tax refunded, over client revenue, both over the period in view. Client revenue is the categories with the revenue role, ' +
  'so a grant, interest or a refund never enlarges the base. A refund sits in the taxes bucket and lowers the taxes instead.'

const taxes = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { workbook, scoped, profitAndLossRows, window, filters } = current
  const { categories } = workbook
  const tokens = chartTokens()
  const categoryName = names.value.category
  const byType = taxByType(profitAndLossRows, categories, filters.period, window)
  const rate = effectiveTaxRate(profitAndLossRows, categories, filters.period, window)
  const taxOnPay = ownerCost(profitAndLossRows, categories, filters.period, window).taxOnPay
  const series = categorySeries(
    byType.types.map((type) => type.category),
    tokens,
    categoryName,
  )
  const colourOf = new Map(series.flatMap((entry) => entry.categories.map((category) => [category, entry.colour])))
  const revenueCategories = categoriesWithRole(categories, PACK_ROLES.revenue)
  const ownerPayTaxCategories = categoriesWithRole(categories, PACK_ROLES.ownerPayTax)
  const watched = categoriesWithRole(categories, PACK_ROLES.watched)
  const unit = settings.value.bucketLabels.taxes
  const percent = new Intl.NumberFormat(settings.value.numberLocale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return {
    period: periodInWords(filters.period, window),
    missing: [
      ...(revenueCategories.length === 0 ? [{ role: PACK_ROLES.revenue, leftOut: 'the tax rate has no revenue to divide by' }] : []),
      ...(ownerPayTaxCategories.length === 0 ? [{ role: PACK_ROLES.ownerPayTax, leftOut: 'tax on owner pay reads zero' }] : []),
      ...(watched.length === 0 ? [{ role: PACK_ROLES.watched, leftOut: 'no tax has a payment calendar' }] : []),
    ],
    tiles: [
      {
        label: `${unit} paid`,
        value: formatWholeMoney(rate.netTaxes.amount),
        to: drillLocation(rate.netTaxes.drill),
        caption: 'Net of refunds',
        definition: `Everything in the ${unit.toLowerCase()} bucket over the period in view. A refund booked there lowers it.`,
      },
      {
        label: 'Effective tax rate',
        value: rate.rate === null ? '–' : percent.format(rate.rate),
        to: drillLocation(rate.netTaxes.drill),
        caption: rate.rate === null ? 'No client revenue in this period' : `${formatWholeMoney(rate.netTaxes.amount)} on ${formatWholeMoney(rate.revenue.amount)} of revenue`,
        definition: RATE_DEFINITION,
      },
      {
        label: 'Tax on owner pay',
        value: formatWholeMoney(taxOnPay.amount),
        to: ownerPayTaxCategories.length === 0 ? null : drillLocation(taxOnPay.drill),
        caption: ownerPayTaxCategories.length === 0 ? 'No category has the owner-pay-tax role' : ownerPayTaxCategories.map(categoryName).join(', '),
        definition: 'The taxes owed because the owner was paid: the categories with the owner-pay-tax role. Corporate income tax stays out, since the company owes it on profit either way.',
      },
    ],
    chart: taxByTypeChart(byType.months, series, tokens),
    empty: byType.types.length === 0,
    legend: [...categoryLegend(series), { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
    types: byType.types.map((type) => ({
      category: type.category,
      name: categoryName(type.category),
      colour: colourOf.get(type.category) ?? 'var(--chart-ink)',
      total: type.total.amount,
      to: drillLocation(type.total.drill),
      typical: type.typicalMonth,
    })),
    cadences: payrollCadence(scoped, categories, window).map((cadence) => {
      const first = cadence.months[0]?.month
      return {
        category: cadence.category,
        name: categoryName(cadence.category),
        since: first === undefined ? '' : monthLabel(first),
        paid: cadence.monthsPaid,
        elapsed: cadence.monthsElapsed,
        missed: cadence.monthsMissed,
        typical: cadence.typicalMonth,
        allRows: drillLocation(drillToTransactions({ period: { preset: 'all' }, categories: [cadence.category] })),
        cells: cadence.months.map((month) => ({
          month: month.month,
          state: month.state,
          amount: month.amount.amount,
          to: month.state === 'not-yet-due' ? null : drillLocation(month.amount.drill),
        })),
      }
    }),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Taxes" description="What the state took, by type, and whether every monthly payroll obligation landed." />
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && taxes">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />
        <MissingRoles :missing="taxes.missing" />

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiTile v-for="(tile, index) in taxes.tiles" :key="tile.label" v-bind="tile" :class="{ 'col-span-2 lg:col-span-1': index === 2 }" />
        </div>

        <DrillChartCard
          :chart="taxes.chart"
          title="Tax by type, by month"
          :subtitle="`${taxes.period}. Click a month or a band for its rows.`"
          definition="Each category of the taxes bucket, stacked. A refund dips below zero in the month it landed. The month still running is hatched and counts in no typical amount."
          :empty="taxes.empty"
          :height="320"
          :phone-height="260"
        >
          <template #legend><ChartLegend :entries="taxes.legend" /></template>
        </DrillChartCard>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">By type</h2>
              <p class="mt-0.5 text-xs text-muted">{{ taxes.period }}. Typical is the median of the complete months with a payment.</p>
            </header>
            <p v-if="taxes.types.length === 0" class="px-5 py-8 text-sm text-muted">No tax moved in this period.</p>
            <div v-else class="overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
              <table class="data-table w-full text-sm" data-testid="tax-types">
                <thead>
                  <tr>
                    <th scope="col" class="text-start">Type</th>
                    <th scope="col" class="text-end">Paid</th>
                    <th scope="col" class="text-end">Typical</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="type in taxes.types" :key="type.category">
                    <th scope="row" class="w-full text-start font-normal">
                      <DrillLink :to="type.to" class="inline-flex min-w-0 items-center gap-2 text-toned">
                        <span class="size-2.5 shrink-0 rounded-[2px]" :style="{ background: type.colour }" aria-hidden="true" />
                        <span class="max-w-32 truncate sm:max-w-none">{{ type.name }}</span>
                      </DrillLink>
                    </th>
                    <td class="text-end">
                      <DrillLink :to="type.to" :label="`${type.name}, open the rows`"><MoneyText :cents="type.total" precision="whole" /></DrillLink>
                    </td>
                    <td class="figure text-end text-muted">{{ type.typical === null ? '–' : formatWholeMoney(type.typical) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" data-testid="payroll-cadence">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">Payroll cadence</h2>
              <p class="mt-0.5 text-xs text-muted">Every watched tax, month by month since its first payment. A month counts as paid when any payment landed in it.</p>
            </header>
            <p v-if="taxes.cadences.length === 0" class="px-5 py-8 text-sm text-muted">No watched tax category has a payment yet.</p>
            <div v-else class="flex flex-col gap-6 px-4 pt-3 pb-4 sm:px-5">
              <section v-for="cadence in taxes.cadences" :key="cadence.category" :aria-label="cadence.name" class="flex flex-col gap-3">
                <h3 class="text-sm font-medium text-highlighted">{{ cadence.name }}, since {{ cadence.since }}</h3>
                <dl class="grid grid-cols-3 gap-3">
                  <div class="min-w-0">
                    <dt class="text-xs text-muted">Complete months paid</dt>
                    <dd class="text-sm font-medium text-highlighted">
                      <DrillLink :to="cadence.allRows" :label="`${cadence.name}, ${cadence.paid} of ${cadence.elapsed} months paid, open the rows`">
                        <span class="figure">{{ cadence.paid }} of {{ cadence.elapsed }}</span>
                      </DrillLink>
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-xs text-muted">Missed</dt>
                    <dd class="figure text-sm font-medium" :class="cadence.missed === 0 ? 'text-highlighted' : 'text-negative'">{{ cadence.missed === 0 ? 'None' : cadence.missed }}</dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-xs text-muted">Typical month</dt>
                    <dd class="text-sm font-medium text-highlighted">
                      <DrillLink v-if="cadence.typical !== null" :to="cadence.allRows" :label="`${cadence.name}, typical month, open the rows`">
                        <MoneyText :cents="cadence.typical" precision="whole" />
                      </DrillLink>
                      <span v-else>–</span>
                    </dd>
                  </div>
                </dl>
                <CadenceCalendar :name="cadence.name" :cells="cadence.cells" />
              </section>
            </div>
          </section>
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
