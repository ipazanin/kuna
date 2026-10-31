<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { chartTokens } from '../../../../../shared/charts/chartTokens'
import { addMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import ChartLegend from '../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../../../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../filters/application/filterStore'
import { periodInWords } from '../../../filters/domain/periodInWords'
import { averagedPeriod, periodMonths } from '../../../filters/domain/periodPresets'
import DrillChartCard from '../../../filters/presentation/DrillChartCard.vue'
import DrillChartPlot from '../../../filters/presentation/DrillChartPlot.vue'
import { filterChips } from '../../../filters/domain/filterChips'
import { useSettings } from '../../../settings/application/useSettings'
import { amountLocaleOf } from '../../../settings/domain/settings'
import type { FilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../workbook/application/useDisplayNames'
import type { TracedRate } from '../domain/cit/citLiability'
import { forecastYear } from '../domain/forecast/forecastYear'
import type { YearForecast } from '../domain/forecast/forecastYear'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { ownerBenefits } from '../domain/ownerBenefits'
import { ownerNetWithProfit } from '../domain/ownerNetWithProfit'
import { ownerCost } from '../domain/ownerCost'
import { loanMonths } from '../domain/ownerLoans'
import { netPayPerMonth, ownerTake, ownerTakeByMonth } from '../domain/ownerTake'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import BuildUpButton from './BuildUpButton.vue'
import FigureDialog from './FigureDialog.vue'
import OwnerBenefitsCard from './OwnerBenefitsCard.vue'
import { OWNER_NET_TITLE, ownerNetDetail } from './ownerNetDetail'
import { categoryLegend, loanBalanceChart, ownerDrawsChart, ownerPaySeries, ownerTakeRing } from './packCharts'
import { plural } from '../../../../../shared/text/translation'
import { words } from './words'

/** What the owner took out over the period in view, what it cost the company, and how it was paid. */
const props = defineProps<{
  ledger: FilteredLedger
  /** The newest booking, the day Year's forecast is seen on. */
  asOf: CivilDate
}>()

const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

/** The same object while only the filters change, so each year's forecast runs once per workbook. */
const asBooked = computed(() => props.ledger.booked)
const booked = computed(() => hrDooWorkbook(asBooked.value))

/** Year's forecast of a year, seen on the newest booking, which the dividend comparison and the profit included read. */
const forecastOf = computed(() => {
  const books = booked.value
  const asOf = props.asOf
  const known = new Map<number, YearForecast>()
  return (year: number): YearForecast => {
    const made = known.get(year) ?? forecastYear(books, year, asOf)
    known.set(year, made)
    return made
  }
})

const corporateRateOf = computed(() => {
  const of = forecastOf.value
  return (year: number): TracedRate => of(year).liability.rate
})

const netOpen = ref(false)

const takeInView = computed(() => {
  const { profitAndLossRows, workbook, window, filters } = props.ledger
  return ownerTake(profitAndLossRows, workbook.categories, filters.period, window)
})

/** The days an average counts and the take over them. A rolling window leaves out the month so far. */
const averaged = computed(() => {
  const { profitAndLossRows, workbook, window, filters } = props.ledger
  const period = averagedPeriod(filters.period, window)
  return { period, take: ownerTake(profitAndLossRows, workbook.categories, period, window) }
})

/** The tile beside Monthly net pay that counts the period's profit as the months earn it, with its build-up. */
const net = computed(() => {
  const { window, filters } = props.ledger
  const periodOnly = filters.accounts.length > 0 || filterChips(filters, { counterparty: String, bucket: String, category: String }).length > 0
  const tile = (value: string, caption = '') => ({
    label: OWNER_NET_TITLE,
    value,
    to: null,
    caption,
    definition: words.taken.netDefinition,
  })
  const empty = { detail: null, unregistered: false, periodOnly }
  try {
    const figures = ownerNetWithProfit(averaged.value.take, booked.value, filters.period, window, props.asOf, {
      profitBeforeTax: (year) => forecastOf.value(year).profitBeforeTax,
      corporateRate: corporateRateOf.value,
    })
    if (figures === null) {
      return { ...empty, tile: tile('–', words.taken.noMonthInView) }
    }
    if (figures.state === 'unregistered') {
      return { ...empty, tile: tile('–'), unregistered: true }
    }
    const caption =
      figures.profitMonths.length === 0 ? words.taken.noProfitMonth : words.taken.payAndProfit(formatMoney(figures.payPerMonth), formatMoney(figures.profitPerMonth), filters.period.preset === 'all')
    return { ...empty, tile: tile(formatMoney(figures.perMonth), caption), detail: ownerNetDetail(figures, periodInWords(filters.period, window), drillLocation) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { ...empty, tile: tile('–', words.taken.notWorkedOut(failure.message)) }
    }
    throw failure
  }
})

const taken = computed(() => {
  const { workbook, booked, profitAndLossRows, window, filters } = props.ledger
  const { categories } = workbook
  const tokens = chartTokens()
  const categoryName = names.value.category
  const payLabel = settings.value.bucketLabels['owner-pay']
  const period = periodInWords(filters.period, window)
  const take = takeInView.value
  const cost = ownerCost(profitAndLossRows, categories, filters.period, window)
  const benefits = ownerBenefits(profitAndLossRows, categories, filters.period, window)
  const perMonth = netPayPerMonth(averaged.value.take, averaged.value.period, window)
  const months = periodMonths(filters.period, window)
  const takeMonths = ownerTakeByMonth(profitAndLossRows, categories, months, window)
  const pay = categories.filter((category) => category.bucket === 'owner-pay')
  const loanOut = categoriesWithRole(categories, PACK_ROLES.ownerLoanOut)
  const loanRepaid = categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)
  const loanSlugs = [...loanOut, ...loanRepaid].filter((slug) => pay.some((category) => category.slug === slug))
  const loansArePay = loanSlugs.length > 0
  const moved = pay.map((category) => category.slug).filter((slug) => takeMonths.some((month) => month.byCategory[slug]?.amount !== 0))
  const rentTaxDrawn = takeMonths.some((month) => month.rentTax.amount !== 0)
  const series = ownerPaySeries(pay, moved, loanSlugs, rentTaxDrawn, tokens, categoryName)
  const ring = ownerTakeRing(take, filters.period, series, categoryName)
  const percent = new Intl.NumberFormat(amountLocaleOf(settings.value), { style: 'percent', maximumFractionDigits: 0 })
  const withoutLoans = formatMoney(take.withoutLoans.amount)
  const rentTaxed = take.rentTax.amount !== 0
  const parts = ring.parts.map((part): DonutPart => ({ ...part, to: drillLocation(part.drill) }))
  const shares = parts.map((part) => `${part.label} ${formatMoney(part.value)}`).join(', ')
  const aside = ring.aside.map((line) => ({ ...line, to: drillLocation(line.drill) }))
  const benefitName = benefits === null ? null : categoryName(benefits.category)
  const fromCosts = benefits !== null && benefits.total.amount !== 0
  return {
    period,
    payLabel,
    benefits,
    tiles: [
      {
        label: words.taken.take,
        value: formatMoney(take.total.amount),
        to: drillLocation(take.total.drill),
        caption: fromCosts ? words.taken.takeFromCosts(formatMoney(benefits.total.amount)) : loansArePay ? words.taken.loansIn : words.taken.loansOut,
        definition: words.taken.takeDefinition(payLabel, loansArePay, benefitName, rentTaxed),
      },
      ...(benefits === null
        ? []
        : [
            {
              label: benefitName ?? '',
              value: formatMoney(benefits.total.amount),
              to: drillLocation(benefits.total.drill),
              caption: plural(words.taken.payments(benefits.payments), benefits.payments),
              definition: words.taken.benefitsDefinition,
            },
          ]),
      {
        label: words.taken.grossCost,
        value: formatMoney(cost.gross.amount),
        to: drillLocation(cost.gross.drill),
        caption: words.taken.taxOnPay(formatMoney(addMoney(cost.taxOnPay.amount, take.rentTax.amount))),
        definition: words.taken.grossCostDefinition(rentTaxed),
      },
      {
        label: words.taken.netShare,
        value: cost.netShare === null ? '–' : percent.format(cost.netShare),
        to: drillLocation(cost.gross.drill),
        caption: cost.netShare === null ? words.taken.nothingPaid : words.taken.netShareOf(withoutLoans, formatMoney(cost.grossWithoutLoans)),
        definition: words.taken.netShareDefinition(loansArePay, rentTaxed, benefitName),
      },
      {
        label: words.taken.monthlyNetPay,
        value: perMonth === null ? '–' : formatMoney(perMonth.perMonth),
        to: drillLocation(averaged.value.take.withoutLoans.drill),
        caption: perMonth === null ? words.taken.noMonthInView : plural(words.taken.over(formatMoney(averaged.value.take.withoutLoans.amount), perMonth.months), perMonth.months),
        definition: words.taken.monthlyNetPayDefinition(payLabel, loansArePay, rentTaxed, benefitName),
      },
    ],
    ring: {
      parts,
      total: formatMoney(ring.ringTotal),
      totalLabel: aside.length === 0 ? words.taken.ring.ownerTake : aside.some((line) => line.key === 'loans') && !rentTaxed ? words.taken.ring.withoutLoans : words.taken.ring.paidOut,
      aside,
      takeTotal: { amount: ring.total, to: drillLocation(take.total.drill) },
      description:
        parts.length === 0
          ? words.taken.ring.nothing(period)
          : words.taken.ring.description(period, shares, aside.map((line) => ` ${line.label} ${formatMoney(line.amount, 'negative')}.`).join(''), formatMoney(ring.total)),
      summary: words.taken.ring.inAll(formatMoney(ring.total)),
    },
    reimbursements: take.reimbursements.map((line) => ({ key: line.category, name: categoryName(line.category), amount: line.amount.amount, to: drillLocation(line.amount.drill) })),
    loanBalance: loanOut.length === 0 ? null : loanBalanceChart(loanMonths(booked.transactions, categories, months, window), tokens.buckets['owner-pay'], tokens),
    draws: ownerDrawsChart(takeMonths, series, tokens),
    drawsSubtitle: words.taken.drawsSubtitle(period, rentTaxDrawn),
    drawsEmpty: series.length === 0,
    drawsLegend: [...categoryLegend(series), { label: words.taken.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <DashboardGrid layout="tiles" data-testid="owner-taken-tiles">
      <KpiTile v-for="tile in taken.tiles" :key="tile.label" v-bind="tile" />
      <KpiTile v-bind="net.tile" data-testid="owner-net-with-profit">
        <template v-if="net.detail" #value>
          <BuildUpButton :cents="net.detail.cents" :label="OWNER_NET_TITLE" @open="netOpen = true" />
        </template>
        <p v-if="net.unregistered" class="mt-1.5 text-xs text-muted" data-testid="owner-net-unregistered">
          {{ words.taken.profitNeeds }}<span class="identifier break-all">hr_company_registered</span>.
          <DrillLink :to="{ path: '/company/settings', hash: '#company-registered' }" in-prose class="text-highlighted">{{ words.taken.setOnSettings }}</DrillLink>
        </p>
        <p v-else-if="net.detail && net.periodOnly" class="mt-1.5 text-xs text-muted" data-testid="owner-net-period-only">{{ words.taken.profitFollowsPeriod }}</p>
      </KpiTile>
    </DashboardGrid>
    <FigureDialog v-if="net.detail" v-model:open="netOpen" :detail="net.detail" />

    <DashboardGrid>
      <DonutCard
        :title="words.taken.ring.title"
        :subtitle="words.taken.ring.subtitle(taken.period)"
        :definition="words.taken.ring.definition"
        :description="taken.ring.description"
        :parts="taken.ring.parts"
        :total="taken.ring.total"
        :total-label="taken.ring.totalLabel"
        data-testid="owner-take"
      >
        <template v-if="taken.loanBalance" #beside>
          <div class="flex flex-col gap-1" data-testid="owner-loan-balance">
            <p class="text-xs text-muted">{{ words.taken.ring.loanBalance }}</p>
            <DrillChartPlot :chart="taken.loanBalance" :height="168" :phone-height="180" />
          </div>
        </template>
        <template #below>
          <ul v-if="taken.ring.aside.length > 0" class="mt-2 flex flex-col border-t border-default pt-2" data-testid="owner-take-aside">
            <li v-for="line in taken.ring.aside" :key="line.key" class="aside-row">
              <DrillLink :to="line.to" :label="words.figure.openRows(line.label)" class="min-w-0 text-toned">{{ line.label }}</DrillLink>
              <MoneyText :cents="line.amount" class="text-highlighted" />
            </li>
            <li class="aside-row font-medium">
              <span class="text-toned">{{ words.taken.take }}</span>
              <DrillLink :to="taken.ring.takeTotal.to" :label="words.figure.openRows(words.taken.take)" data-testid="owner-take-total">
                <MoneyText :cents="taken.ring.takeTotal.amount" class="text-highlighted" />
              </DrillLink>
            </li>
          </ul>
          <p class="mt-3 text-xs text-muted" data-testid="owner-salaries">
            <DrillLink to="/company/salaries" in-prose class="text-toned">{{ words.taken.ring.salariesLink }}</DrillLink
            >{{ words.taken.ring.salariesSplit }}
          </p>
          <p v-if="taken.reimbursements.length > 0" class="mt-3 text-xs text-muted" data-testid="owner-reimbursements">
            {{ words.taken.ring.reimbursementsOutside }}
            <template v-for="(line, index) in taken.reimbursements" :key="line.key">
              <DrillLink :to="line.to" in-prose class="text-toned">{{ line.name }}</DrillLink> <MoneyText :cents="line.amount" />{{ index < taken.reimbursements.length - 1 ? ', ' : '.' }}
            </template>
          </p>
        </template>
      </DonutCard>

      <DrillChartCard :chart="taken.draws" :title="words.taken.byMonth(taken.payLabel)" :subtitle="taken.drawsSubtitle" :empty="taken.drawsEmpty" :height="320" :phone-height="260">
        <template #legend><ChartLegend :entries="taken.drawsLegend" /></template>
      </DrillChartCard>
    </DashboardGrid>

    <OwnerBenefitsCard v-if="taken.benefits" :ledger="ledger" :benefits="taken.benefits" :period="taken.period" :corporate-rate-of="corporateRateOf" />
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
