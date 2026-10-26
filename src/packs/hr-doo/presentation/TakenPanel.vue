<script setup lang="ts">
import { computed } from 'vue'

import type { CivilDate } from '../../../shared/calendar/civilDate'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
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
import DrillChartPlot from '../../../features/filters/presentation/DrillChartPlot.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { ownerBenefits } from '../domain/ownerBenefits'
import { ownerCost } from '../domain/ownerCost'
import { loanMonths } from '../domain/ownerLoans'
import { netPayPerMonth, ownerTake, ownerTakeByMonth } from '../domain/ownerTake'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import OwnerBenefitsCard from './OwnerBenefitsCard.vue'
import { categoryLegend, loanBalanceChart, ownerDrawsChart, ownerPaySeries, ownerTakeRing } from './packCharts'

/** What the owner took out over the period in view, what it cost the company, and how it was paid. */
const props = defineProps<{
  ledger: FilteredLedger
  /** The newest booking, the day Year's forecast is seen on. */
  asOf: CivilDate
}>()

const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const taken = computed(() => {
  const { workbook, booked, profitAndLossRows, window, filters } = props.ledger
  const { categories } = workbook
  const tokens = chartTokens()
  const categoryName = names.value.category
  const payLabel = settings.value.bucketLabels['owner-pay']
  const period = periodInWords(filters.period, window)
  const take = ownerTake(profitAndLossRows, categories, filters.period, window)
  const cost = ownerCost(profitAndLossRows, categories, filters.period, window)
  const benefits = ownerBenefits(profitAndLossRows, categories, filters.period, window)
  const perMonth = netPayPerMonth(take, filters.period, window)
  const months = chartedMonths(filters.period, window)
  const takeMonths = ownerTakeByMonth(profitAndLossRows, categories, months, window)
  const pay = categories.filter((category) => category.bucket === 'owner-pay')
  const loanOut = categoriesWithRole(categories, PACK_ROLES.ownerLoanOut)
  const loanRepaid = categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)
  const loanSlugs = [...loanOut, ...loanRepaid].filter((slug) => pay.some((category) => category.slug === slug))
  const loansArePay = loanSlugs.length > 0
  const moved = pay.map((category) => category.slug).filter((slug) => takeMonths.some((month) => month.byCategory[slug]?.amount !== 0))
  const series = ownerPaySeries(pay, moved, loanSlugs, tokens, categoryName)
  const ring = ownerTakeRing(take, filters.period, series, categoryName)
  const percent = new Intl.NumberFormat(settings.value.numberLocale, { style: 'percent', maximumFractionDigits: 0 })
  const withoutLoans = formatWholeMoney(take.withoutLoans.amount)
  const loanNote = loansArePay ? ' Loans to the owner and their repayments stay out, since a loan is not pay.' : ''
  const parts = ring.parts.map((part): DonutPart => ({ ...part, to: drillLocation(part.drill) }))
  const shares = parts.map((part) => `${part.label} ${formatWholeMoney(part.value)}`).join(', ')
  const aside = ring.aside.map((line) => ({ ...line, to: drillLocation(line.drill) }))
  const benefitName = benefits === null ? '' : categoryName(benefits.category)
  const fromCosts = benefits !== null && benefits.total.amount !== 0
  return {
    period,
    payLabel,
    benefits,
    tiles: [
      {
        label: 'Owner take',
        value: formatWholeMoney(take.total.amount),
        to: drillLocation(take.total.drill),
        caption: fromCosts ? `${formatWholeMoney(benefits.total.amount)} of it from company costs` : loansArePay ? 'Loans in, repayments out' : 'Loans left out, as financing',
        definition:
          (loansArePay
            ? `Everything in the ${payLabel.toLowerCase()} bucket over the period in view. A loan to the owner is pay taken early and its repayment is pay handed back, so both count. Reimbursements settle costs and are left out.`
            : `Everything in the ${payLabel.toLowerCase()} bucket over the period in view. Loans to the owner are in the financing bucket, so neither they nor their repayments count. Reimbursements settle costs and are left out.`) +
          (benefits === null ? '' : ` ${benefitName}, the owner's parts of company costs, count too.`),
      },
      ...(benefits === null
        ? []
        : [
            {
              label: benefitName,
              value: formatWholeMoney(benefits.total.amount),
              to: drillLocation(benefits.total.drill),
              caption: `${benefits.payments} ${benefits.payments === 1 ? 'payment' : 'payments'}`,
              definition: `The owner's parts of company costs, at each row's owner share. They count as owner pay with no tax on them. The share is your own estimate, and the accountant books these costs in full.`,
            },
          ]),
      {
        label: 'Gross cost of the owner',
        value: formatWholeMoney(cost.gross.amount),
        to: drillLocation(cost.gross.drill),
        caption: `${formatWholeMoney(cost.taxOnPay.amount)} of it tax on the pay`,
        definition: 'Owner take plus the taxes owed because the owner was paid, the categories with the owner-pay-tax role. Corporate income tax stays out.',
      },
      {
        label: 'Net share of gross cost',
        value: cost.netShare === null ? '–' : percent.format(cost.netShare),
        to: drillLocation(cost.gross.drill),
        caption: cost.netShare === null ? 'Nothing paid to the owner' : `${withoutLoans} of ${formatWholeMoney(cost.grossWithoutLoans)} gross cost`,
        definition:
          `How much of what the company spent on paying the owner reached the owner: the owner take without loans over itself plus the taxes owed because the owner was paid. ` +
          `100% would mean no tax on top.${loanNote}${benefits === null ? '' : ` ${benefitName} count in the take and carry no tax, so they raise it.`}`,
      },
      {
        label: 'Monthly net pay',
        value: perMonth === null ? '–' : formatWholeMoney(perMonth.perMonth),
        to: drillLocation(take.withoutLoans.drill),
        caption: perMonth === null ? 'No month of the ledger in view' : `${withoutLoans} over ${perMonth.months} ${perMonth.months === 1 ? 'month' : 'months'}`,
        definition:
          `What the owner was paid a month from every owner pay category, such as salary, bonus, dividend and rent${benefits === null ? '' : `, ${benefitName.toLowerCase()} included`}: the owner take without loans over the months of the period. ` +
          `A month the ledger covers only in part, such as the month so far, counts as a whole month, as it does in the chart of ${payLabel.toLowerCase()} by month.${loanNote}`,
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
    loanBalance: loanOut.length === 0 ? null : loanBalanceChart(loanMonths(booked.transactions, categories, months, window), tokens.buckets['owner-pay'], tokens),
    draws: ownerDrawsChart(takeMonths, series, tokens),
    drawsEmpty: series.length === 0,
    drawsLegend: [...categoryLegend(series), { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-2 gap-3" :class="taken.benefits === null ? 'lg:grid-cols-4' : 'lg:grid-cols-3 2xl:grid-cols-5'" data-testid="owner-taken-tiles">
      <KpiTile v-for="tile in taken.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <DonutCard
        title="Owner take by type"
        :subtitle="`${taken.period}. Paid to the owner on balance, by category.`"
        definition="Each owner pay category the company paid out more than it took back, as a share of the ring. Loans can be negative, so they sit under the ring, and with it they make the owner take. Beside the ring, what the owner owed the company at the end of each month, over every loan since the ledger began."
        :description="taken.ring.description"
        :parts="taken.ring.parts"
        :total="taken.ring.total"
        :total-label="taken.ring.totalLabel"
        data-testid="owner-take"
      >
        <template v-if="taken.loanBalance" #beside>
          <div class="flex flex-col gap-1" data-testid="owner-loan-balance">
            <p class="text-xs text-muted">Owed by the owner at each month end, all loans since the ledger began</p>
            <DrillChartPlot :chart="taken.loanBalance" :height="168" :phone-height="180" />
          </div>
        </template>
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

    <OwnerBenefitsCard v-if="taken.benefits" :ledger="ledger" :benefits="taken.benefits" :period="taken.period" :as-of="asOf" />
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
