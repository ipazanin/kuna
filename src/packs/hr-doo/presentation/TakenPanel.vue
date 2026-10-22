<script setup lang="ts">
import { computed } from 'vue'

import { chartTokens } from '../../../shared/charts/chartTokens'
import { currencyUnitName, formatWholeMoney } from '../../../shared/money/moneyFormat'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import { periodInWords } from '../../../features/filters/domain/periodInWords'
import { chartedMonths } from '../../../features/filters/domain/periodPresets'
import DrillChartCard from '../../../features/filters/presentation/DrillChartCard.vue'
import FilterBar from '../../../features/filters/presentation/FilterBar.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { ownerCost } from '../domain/ownerCost'
import { ownerTake, ownerTakeByMonth } from '../domain/ownerTake'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole } from '../domain/packRoles'
import { categoryLegend, ownerDrawsChart, ownerPaySeries, ownerTakeRing } from './packCharts'

/** What the owner took out over the period in view, what it cost the company, and how it was paid. */
const props = defineProps<{
  ledger: FilteredLedger
}>()

const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const taken = computed(() => {
  const { workbook, profitAndLossRows, window, filters } = props.ledger
  const { categories } = workbook
  const tokens = chartTokens()
  const categoryName = names.value.category
  const payLabel = settings.value.bucketLabels['owner-pay']
  const period = periodInWords(filters.period, window)
  const take = ownerTake(profitAndLossRows, categories, filters.period, window)
  const cost = ownerCost(profitAndLossRows, categories, filters.period, window)
  const takeMonths = ownerTakeByMonth(profitAndLossRows, categories, chartedMonths(filters.period, window), window)
  const pay = categoriesInBucket(categories, 'owner-pay')
  const loanSlugs = [...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut), ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)].filter((slug) => pay.includes(slug))
  const loansArePay = loanSlugs.length > 0
  const moved = pay.filter((category) => takeMonths.some((month) => month.byCategory[category]?.amount !== 0))
  const series = ownerPaySeries(moved, loanSlugs, tokens, categoryName)
  const ring = ownerTakeRing(take, filters.period, series, categoryName)
  const times = new Intl.NumberFormat(settings.value.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const parts = ring.parts.map((part): DonutPart => ({ ...part, to: drillLocation(part.drill) }))
  const shares = parts.map((part) => `${part.label} ${formatWholeMoney(part.value)}`).join(', ')
  const aside = ring.aside.map((line) => ({ ...line, to: drillLocation(line.drill) }))
  return {
    period,
    payLabel,
    tiles: [
      {
        label: 'Owner take',
        value: formatWholeMoney(take.total.amount),
        to: drillLocation(take.total.drill),
        caption: loansArePay ? 'Loans in, repayments out' : 'Loans left out, as financing',
        definition: loansArePay
          ? `Everything in the ${payLabel.toLowerCase()} bucket over the period in view. A loan to the owner is pay taken early and its repayment is pay handed back, so both count. Reimbursements settle costs and are left out.`
          : `Everything in the ${payLabel.toLowerCase()} bucket over the period in view. Loans to the owner are in the financing bucket, so neither they nor their repayments count. Reimbursements settle costs and are left out.`,
      },
      {
        label: 'Gross cost of the owner',
        value: formatWholeMoney(cost.gross.amount),
        to: drillLocation(cost.gross.drill),
        caption: `${formatWholeMoney(cost.taxOnPay.amount)} of it tax on the pay`,
        definition: 'Owner take plus the taxes owed because the owner was paid, the categories with the owner-pay-tax role. Corporate income tax stays out.',
      },
      {
        label: `Cost per ${currencyUnitName()} received`,
        value: cost.costPerEuroReceived === null ? '–' : `${times.format(cost.costPerEuroReceived)}×`,
        to: drillLocation(cost.gross.drill),
        caption: cost.costPerEuroReceived === null ? 'Nothing paid to the owner' : 'Gross cost over owner take',
        definition: `What the company spends for each ${currencyUnitName()} the owner takes out. 1.00× would mean no tax on top.${loansArePay ? ' Loans count in the take, so a year with loans reads cheaper.' : ''}`,
      },
    ],
    ring: {
      parts,
      total: formatWholeMoney(ring.ringTotal),
      totalLabel: aside.length === 0 ? 'owner take' : aside.some((line) => line.key === 'loans') ? 'without loans' : 'paid out',
      aside,
      takeTotal: { amount: ring.total, to: drillLocation(take.total.drill) },
      description:
        parts.length === 0
          ? `Nothing was paid to the owner in ${period}.`
          : `Owner take by type in ${period}: ${shares}.${aside.map((line) => ` ${line.label} ${formatWholeMoney(line.amount, 'negative')}.`).join('')} Together ${formatWholeMoney(ring.total)}.`,
      summary: `${formatWholeMoney(ring.total)} in all`,
    },
    reimbursements: take.reimbursements.map((line) => ({ key: line.category, name: categoryName(line.category), amount: line.amount.amount, to: drillLocation(line.amount.drill) })),
    draws: ownerDrawsChart(takeMonths, series, tokens),
    drawsEmpty: series.length === 0,
    drawsLegend: [...categoryLegend(series), { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="owner-taken-tiles">
      <KpiTile v-for="tile in taken.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <DonutCard
        title="Owner take by type"
        :subtitle="`${taken.period}. Paid to the owner on balance, by category.`"
        definition="Each owner pay category the company paid out more than it took back, as a share of the ring. Loans can be negative, so they sit under the ring, and with it they make the owner take."
        :description="taken.ring.description"
        :parts="taken.ring.parts"
        :total="taken.ring.total"
        :total-label="taken.ring.totalLabel"
        data-testid="owner-take"
      >
        <template #below>
          <ul v-if="taken.ring.aside.length > 0" class="mt-2 flex flex-col border-t border-default pt-2" data-testid="owner-take-aside">
            <li v-for="line in taken.ring.aside" :key="line.key" class="aside-row">
              <DrillLink :to="line.to" :label="`${line.label}, open the rows`" class="min-w-0 text-toned">{{ line.label }}</DrillLink>
              <MoneyText :cents="line.amount" precision="whole" class="text-highlighted" />
            </li>
            <li class="aside-row font-medium">
              <span class="text-toned">Owner take</span>
              <DrillLink :to="taken.ring.takeTotal.to" label="Owner take, open the rows" data-testid="owner-take-total">
                <MoneyText :cents="taken.ring.takeTotal.amount" precision="whole" class="text-highlighted" />
              </DrillLink>
            </li>
          </ul>
          <p v-if="taken.reimbursements.length > 0" class="mt-3 text-xs text-muted" data-testid="owner-reimbursements">
            Outside the owner take, since they settle costs:
            <template v-for="(line, index) in taken.reimbursements" :key="line.key">
              <DrillLink :to="line.to" in-prose class="text-toned">{{ line.name }}</DrillLink> <MoneyText :cents="line.amount" precision="whole" />{{ index < taken.reimbursements.length - 1 ? ', ' : '.' }}
            </template>
          </p>
        </template>
      </DonutCard>

      <DrillChartCard
        :chart="taken.draws"
        :title="`${taken.payLabel} by month`"
        :subtitle="`${taken.period}. Loans and their repayments as one net band, and money handed back below zero.`"
        :empty="taken.drawsEmpty"
        :height="320"
        :phone-height="260"
      >
        <template #legend><ChartLegend :entries="taken.drawsLegend" /></template>
      </DrillChartCard>
    </div>
  </div>
</template>

<style scoped>
.aside-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.25rem;
  font-size: 0.875rem;
}
</style>
