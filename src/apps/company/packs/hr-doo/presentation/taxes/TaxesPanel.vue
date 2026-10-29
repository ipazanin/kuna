<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { LedgerWindow } from '../../../../../../shared/calendar/ledgerWindow'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import { sumMoney } from '../../../../../../shared/money/money'
import { formatMoney, formatWholeMoney } from '../../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DonutCard from '../../../../../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../../../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../../filters/application/filterStore'
import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { Period } from '../../../../filters/domain/filterState'
import { periodInWords } from '../../../../filters/domain/periodInWords'
import DrillChartCard from '../../../../filters/presentation/DrillChartCard.vue'
import { useSettings } from '../../../../settings/application/useSettings'
import { amountLocaleOf } from '../../../../settings/domain/settings'
import { useDisplayNames } from '../../../../workbook/application/useDisplayNames'
import { bookingOfAdvance } from '../../../../workbook/domain/workbook'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { effectiveTaxRate } from '../../domain/effectiveTaxRate'
import { forecastYear } from '../../domain/forecast/forecastYear'
import { payrollCadence } from '../../domain/payrollCadence'
import { taxByType } from '../../domain/taxByType'
import CitObligationList from '../CitObligationList.vue'
import { citObligationLine } from '../CitObligationList.vue'
import { categoryLegend, categorySeries, taxByTypeChart } from '../packCharts'
import { figureLabel } from '../tracedFigureView'
import CadenceCalendar from './CadenceCalendar.vue'

/** What the state took in a year, by type, and whether every payroll month and corporate tax payment landed. */
const props = defineProps<{
  workbook: HrDooWorkbook
  window: LedgerWindow
  year: number
  /** The newest booking, which the corporate tax schedule is seen on. */
  asOf: CivilDate
}>()

const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()
const route = useRoute()

const RATE_DEFINITION =
  'Taxes paid less tax refunded, over client revenue, both over the year. Client revenue is the categories with the revenue role, ' +
  'so a grant, interest or a refund never enlarges the base. A refund sits in the taxes bucket and lowers the taxes instead.'

const taxes = computed(() => {
  const { workbook, window, year } = props
  const { categories } = workbook
  const bookings = [...workbook.transactions, ...workbook.ownerAdvances.map(bookingOfAdvance)]
  const period: Period = { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } }
  const tokens = chartTokens()
  const categoryName = names.value.category
  const byType = taxByType(bookings, categories, period, window)
  const rate = effectiveTaxRate(bookings, categories, period, window)
  const series = categorySeries(
    categories.filter((category) => category.bucket === 'taxes'),
    byType.types.map((type) => type.category),
    tokens,
    categoryName,
  )
  const tokenOf = new Map(series.flatMap((entry) => entry.categories.map((category) => [category, entry.token])))
  const unit = settings.value.bucketLabels.taxes
  const percent = new Intl.NumberFormat(amountLocaleOf(settings.value), { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const words = periodInWords(period, window)
  const parts = byType.types
    .filter((type) => type.total.amount > 0)
    .map((type): DonutPart => ({
      key: type.category,
      label: categoryName(type.category),
      value: type.total.amount,
      colour: tokenOf.get(type.category) ?? '--chart-deemphasis',
      to: drillLocation(type.total.drill),
    }))
  const refunds = byType.types
    .filter((type) => type.total.amount < 0)
    .map((type) => ({ key: type.category, label: categoryName(type.category), amount: type.total.amount, to: drillLocation(type.total.drill) }))
  const paid = parts.reduce((sum, part) => sum + part.value, 0)
  const cadences = payrollCadence(bookings, categories, window).map((cadence) => {
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
  })
  const missed = cadences.reduce((count, cadence) => count + cadence.missed, 0)
  return {
    period: words,
    tiles: [
      {
        label: `${unit} paid`,
        value: formatWholeMoney(rate.netTaxes.amount),
        to: drillLocation(rate.netTaxes.drill),
        caption: 'Net of refunds',
        definition: `Everything in the ${unit.toLowerCase()} bucket over the year. A refund booked there lowers it.`,
      },
      {
        label: 'Effective tax rate',
        value: rate.rate === null ? '–' : percent.format(rate.rate),
        to: drillLocation(rate.netTaxes.drill),
        caption: rate.rate === null ? 'No client revenue in this year' : `${formatWholeMoney(rate.netTaxes.amount)} on ${formatWholeMoney(rate.revenue.amount)} of revenue`,
        definition: RATE_DEFINITION,
      },
    ],
    ring: {
      parts,
      refunds,
      paid,
      net: { amount: rate.netTaxes.amount, to: drillLocation(rate.netTaxes.drill) },
      description:
        parts.length === 0
          ? `No tax was paid in ${words}.`
          : `Tax by type in ${words}: ${parts.map((part) => `${part.label} ${formatWholeMoney(part.value)}`).join(', ')}.${refunds.map((line) => ` ${line.label} ${formatWholeMoney(line.amount, 'negative')}.`).join('')} Net ${formatWholeMoney(rate.netTaxes.amount)}.`,
    },
    chart: taxByTypeChart(byType.months, series, tokens),
    empty: byType.types.length === 0,
    chartSummary: monthsInWords(byType.months.filter((month) => month.total.amount !== 0).length),
    legend: [...categoryLegend(series), { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
    cadences,
    missed,
    cadenceSummary:
      cadences.length === 0
        ? 'No watched tax category has a payment yet'
        : cadences
            .map((cadence) => `${cadences.length === 1 ? '' : `${cadence.name}, `}${cadence.paid} of ${cadence.elapsed} months paid${cadence.missed === 0 ? '' : `, ${cadence.missed} missed`}`)
            .join('. '),
  }
})

/**
 * Corporate income tax from the first tax period on, as the schedule expects it and as the bank
 * rows paid it, seen on the newest booking. It does not follow the year, as the payroll cadence does not.
 */
const corporateTax = computed(() => {
  const { workbook, asOf } = props
  if (workbook.companyFacts.companyRegistered === null) {
    return { state: 'unregistered' as const }
  }
  try {
    const { cit } = forecastYear(workbook, yearOf(asOf), asOf)
    const linkOf = (figure: TracedFigure) => (figure.drill === null ? null : drillLocation(figure.drill))
    const overdue = cit.history.filter((entry) => entry.status === 'overdue')
    const taxYears = [...new Set(cit.history.map((entry) => entry.obligation.taxYear))].sort((earlier, later) => later - earlier)
    return {
      state: 'ready' as const,
      overdue: { count: overdue.length, outstanding: sumMoney(overdue.map((entry) => entry.outstanding)) },
      unmatched: cit.unmatched.map((figure, index) => ({ key: `${index}`, label: figureLabel(figure), cents: figure.amount, to: linkOf(figure) })),
      years: taxYears.map((taxYear) => {
        const entries = cit.history.filter((entry) => entry.obligation.taxYear === taxYear)
        return {
          taxYear,
          expected: sumMoney(entries.map((entry) => entry.obligation.expected.amount)),
          paid: sumMoney(entries.map((entry) => entry.paid.amount)),
          lines: entries.map((entry) => citObligationLine(entry, linkOf)),
        }
      }),
    }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed' as const, failure: failure.message }
    }
    throw failure
  }
})

const corporateTaxSummary = computed(() => {
  const tax = corporateTax.value
  if (tax.state === 'unregistered') return 'Needs the day the company was registered'
  if (tax.state === 'failed') return tax.failure
  if (tax.overdue.count > 0) return `${tax.overdue.count} ${tax.overdue.count === 1 ? 'payment' : 'payments'} overdue, ${formatMoney(tax.overdue.outstanding)} still owed`
  return `${tax.years.length} ${tax.years.length === 1 ? 'tax year' : 'tax years'}, nothing overdue`
})

function monthsInWords(count: number): string {
  return count === 0 ? 'No month with a tax payment' : `${count} ${count === 1 ? 'month' : 'months'} with a tax payment`
}

const overdue = computed(() => corporateTax.value.state === 'ready' && corporateTax.value.overdue.count > 0)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-2 gap-3" data-testid="taxes-tiles">
      <KpiTile v-for="tile in taxes.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <AppCard
      id="corporate-tax"
      title="Corporate income tax, expected against paid"
      collapse-id="year.corporate-tax"
      :summary="corporateTaxSummary"
      :reveal="overdue || route.hash === '#corporate-tax'"
      data-testid="corporate-tax"
    >
      <template #subtitle>
        Each year's balance due and monthly advances from the first tax period on, filled by the bank rows oldest due date first, since the annual payment and the advances share one payment code. A
        year whose return is not on the year-end tab sets its advances from our own estimate.
        <template v-if="corporateTax.state === 'ready'">Seen on {{ dayLabel(asOf) }}, the newest booking.</template>
      </template>
      <div v-if="corporateTax.state === 'unregistered'" class="flex items-start gap-2 px-4 py-4 text-sm text-toned sm:px-5">
        <UIcon name="i-lucide-calendar-x" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
        <p>
          <span class="identifier">hr_company_registered</span> is blank, so the tax periods and the schedule of advances are not known.
          <DrillLink :to="{ path: '/settings', hash: '#company-registered' }" in-prose class="text-highlighted">Set it on Settings</DrillLink>
        </p>
      </div>
      <p v-else-if="corporateTax.state === 'failed'" class="px-4 py-4 text-sm text-toned sm:px-5">{{ corporateTax.failure }}</p>
      <template v-else>
        <div v-if="corporateTax.overdue.count > 0 || corporateTax.unmatched.length > 0" class="flex flex-col gap-3 px-4 pt-3 sm:px-5" data-testid="corporate-tax-callouts">
          <p v-if="corporateTax.overdue.count > 0" class="flex items-start gap-2 text-sm text-error" data-testid="corporate-tax-overdue">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {{ corporateTax.overdue.count }} {{ corporateTax.overdue.count === 1 ? 'payment is' : 'payments are' }} overdue, <MoneyText :cents="corporateTax.overdue.outstanding" /> still owed.
            </span>
          </p>
          <div v-if="corporateTax.unmatched.length > 0" class="flex items-start gap-2 text-sm text-toned" data-testid="unmatched-payments">
            <UIcon name="i-lucide-circle-question-mark" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p>Payments no obligation takes, and refunds:</p>
              <ul class="flex flex-col">
                <li v-for="payment in corporateTax.unmatched" :key="payment.key" class="flex items-baseline justify-between gap-3">
                  <DrillLink :to="payment.to" :label="`${payment.label}, open the row`" class="min-w-0 truncate">{{ payment.label }}</DrillLink>
                  <MoneyText :cents="payment.cents" sign="always" />
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p v-if="corporateTax.years.length === 0" class="px-4 py-4 text-sm text-muted sm:px-5">A first tax period pays no advances, and no return has left a balance yet.</p>
        <div v-else class="flex flex-col gap-5 px-4 pt-3 pb-4 sm:px-3">
          <section v-for="entry in corporateTax.years" :key="entry.taxYear" :aria-label="`For ${entry.taxYear}`" class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-highlighted sm:px-2">
              For {{ entry.taxYear }}<span class="font-normal text-muted">, <MoneyText :cents="entry.paid" /> paid of <MoneyText :cents="entry.expected" /></span>
            </h3>
            <CitObligationList :lines="entry.lines" :test-id="`corporate-tax-${entry.taxYear}`" />
          </section>
        </div>
      </template>
    </AppCard>

    <AppCard
      id="payroll-cadence"
      title="Payroll cadence"
      collapse-id="year.payroll-cadence"
      :summary="taxes.cadenceSummary"
      start-collapsed
      :reveal="taxes.missed > 0 || route.hash === '#payroll-cadence'"
      data-testid="payroll-cadence"
    >
      <template #subtitle>
        Every watched tax, month by month since its first payment, whatever the year. A month counts as paid when any payment landed in it.
        <DrillLink to="/company/salaries" in-prose class="text-highlighted" data-testid="payroll-cadence-salaries">Salaries</DrillLink> checks each payday by employee and line.
      </template>
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
    </AppCard>

    <AppCard v-if="taxes.ring.parts.length === 0" title="Tax by type" :subtitle="taxes.period">
      <p class="px-5 py-8 text-sm text-muted">No tax was paid in {{ year }}.</p>
    </AppCard>
    <DonutCard
      v-else
      title="Tax by type"
      :subtitle="`${taxes.period}. Paid on balance, by category.`"
      definition="Each category of the taxes bucket that paid out more than it took back, as a share of the ring. A refund cannot be a slice, so it sits under the ring, and with it the ring makes the taxes paid."
      :description="taxes.ring.description"
      :parts="taxes.ring.parts"
      :total="formatWholeMoney(taxes.ring.paid)"
      :total-label="`paid in ${year}`"
      data-testid="tax-types"
    >
      <template v-if="taxes.ring.refunds.length > 0" #below>
        <ul class="mt-2 flex flex-col border-t border-default pt-2" data-testid="tax-refunds">
          <li v-for="line in taxes.ring.refunds" :key="line.key" class="aside-row">
            <DrillLink :to="line.to" :label="`${line.label}, open the rows`" class="min-w-0 text-toned">Less {{ line.label.toLowerCase() }}</DrillLink>
            <MoneyText :cents="line.amount" precision="whole" class="text-highlighted" />
          </li>
          <li class="aside-row font-medium">
            <span class="text-toned">{{ settings.bucketLabels.taxes }} paid</span>
            <DrillLink :to="taxes.ring.net.to" :label="`${settings.bucketLabels.taxes} paid, open the rows`" data-testid="tax-net">
              <MoneyText :cents="taxes.ring.net.amount" precision="whole" class="text-highlighted" />
            </DrillLink>
          </li>
        </ul>
      </template>
    </DonutCard>

    <DrillChartCard
      :chart="taxes.chart"
      title="Tax by type, by month"
      :subtitle="`${taxes.period}. Click a month or a band for its rows.`"
      definition="Each category of the taxes bucket, stacked. A refund dips below zero in the month it landed. The month still running is hatched."
      :empty="taxes.empty"
      :height="320"
      :phone-height="260"
      collapse-id="year.tax-months"
      :summary="taxes.chartSummary"
      start-collapsed
    >
      <template #legend><ChartLegend :entries="taxes.legend" /></template>
    </DrillChartCard>
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
