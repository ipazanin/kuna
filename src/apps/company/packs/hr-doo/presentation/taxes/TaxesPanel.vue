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
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../../shared/ui/DashboardGrid.vue'
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
import { plural } from '../../../../../../shared/text/translation'
import { words as packWords } from '../words'
import { words } from './words'

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

const RATE_DEFINITION = words.rateDefinition

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
  const inWords = periodInWords(period, window)
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
    period: inWords,
    tiles: [
      {
        label: words.paid(unit),
        value: formatMoney(rate.netTaxes.amount),
        to: drillLocation(rate.netTaxes.drill),
        caption: words.netOfRefunds,
        definition: words.paidDefinition(unit),
      },
      {
        label: words.effectiveRate,
        value: rate.rate === null ? '–' : percent.format(rate.rate),
        to: drillLocation(rate.netTaxes.drill),
        caption: rate.rate === null ? words.noRevenue : words.rateOf(formatMoney(rate.netTaxes.amount), formatMoney(rate.revenue.amount)),
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
          ? words.noTaxPaidIn(inWords)
          : words.byTypeIn(
              inWords,
              parts.map((part) => `${part.label} ${formatMoney(part.value)}`).join(', '),
              refunds.map((line) => ` ${line.label} ${formatMoney(line.amount, 'negative')}.`).join(''),
              formatMoney(rate.netTaxes.amount),
            ),
    },
    chart: taxByTypeChart(byType.months, series, tokens),
    empty: byType.types.length === 0,
    chartSummary: monthsInWords(byType.months.filter((month) => month.total.amount !== 0).length),
    legend: [...categoryLegend(series), { label: words.monthSoFar, colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
    cadences,
    missed,
    cadenceSummary:
      cadences.length === 0
        ? words.noWatchedPayment
        : cadences.map((cadence) => words.cadenceOf(cadences.length === 1 ? null : cadence.name, cadence.paid, cadence.elapsed, cadence.missed)).join('. '),
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
  if (tax.state === 'unregistered') return words.corporate.needsRegistered
  if (tax.state === 'failed') return tax.failure
  if (tax.overdue.count > 0) return plural(words.corporate.overdueSummary(tax.overdue.count, formatMoney(tax.overdue.outstanding)), tax.overdue.count)
  return plural(words.corporate.yearsSummary(tax.years.length), tax.years.length)
})

function monthsInWords(count: number): string {
  return count === 0 ? words.noMonth : plural(words.months(count), count)
}

const overdue = computed(() => corporateTax.value.state === 'ready' && corporateTax.value.overdue.count > 0)
</script>

<template>
  <div class="flex flex-col gap-6">
    <DashboardGrid layout="tiles" data-testid="taxes-tiles">
      <KpiTile v-for="tile in taxes.tiles" :key="tile.label" v-bind="tile" />
    </DashboardGrid>

    <AppCard
      id="corporate-tax"
      :title="words.corporate.title"
      collapse-id="year.corporate-tax"
      :summary="corporateTaxSummary"
      :reveal="overdue || route.hash === '#corporate-tax'"
      data-testid="corporate-tax"
    >
      <template #subtitle>
        {{ words.corporate.subtitle }}
        <template v-if="corporateTax.state === 'ready'">{{ words.corporate.seenOn(dayLabel(asOf)) }}</template>
      </template>
      <div v-if="corporateTax.state === 'unregistered'" class="flex items-start gap-2 px-4 py-4 text-sm text-toned sm:px-5">
        <UIcon name="i-lucide-calendar-x" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p>
          <span class="identifier">hr_company_registered</span>{{ words.corporate.unregistered }}
          <DrillLink :to="{ path: '/company/settings', hash: '#company-registered' }" in-prose class="text-highlighted">{{ words.corporate.setOnSettings }}</DrillLink>
        </p>
      </div>
      <p v-else-if="corporateTax.state === 'failed'" class="px-4 py-4 text-sm text-toned sm:px-5">{{ corporateTax.failure }}</p>
      <template v-else>
        <div v-if="corporateTax.overdue.count > 0 || corporateTax.unmatched.length > 0" class="flex flex-col gap-3 px-4 pt-3 sm:px-5" data-testid="corporate-tax-callouts">
          <p v-if="corporateTax.overdue.count > 0" class="flex items-start gap-2 text-sm text-error" data-testid="corporate-tax-overdue">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {{ plural(words.corporate.overdueBefore(corporateTax.overdue.count), corporateTax.overdue.count) }}<MoneyText :cents="corporateTax.overdue.outstanding" />{{
                words.corporate.overdueAfter
              }}
            </span>
          </p>
          <div v-if="corporateTax.unmatched.length > 0" class="flex items-start gap-2 text-sm text-toned" data-testid="unmatched-payments">
            <UIcon name="i-lucide-circle-question-mark" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <p>{{ words.corporate.unmatched }}</p>
              <ul class="flex flex-col">
                <li v-for="payment in corporateTax.unmatched" :key="payment.key" class="flex items-baseline justify-between gap-3">
                  <DrillLink :to="payment.to" :label="words.corporate.openRow(payment.label)" class="min-w-0 truncate">{{ payment.label }}</DrillLink>
                  <MoneyText :cents="payment.cents" sign="always" />
                </li>
              </ul>
            </div>
          </div>
        </div>
        <p v-if="corporateTax.years.length === 0" class="px-4 py-4 text-sm text-muted sm:px-5">{{ words.corporate.noYears }}</p>
        <div v-else class="flex flex-col gap-5 px-4 pt-3 pb-4 sm:px-3">
          <section v-for="entry in corporateTax.years" :key="entry.taxYear" :aria-label="words.corporate.forYear(entry.taxYear)" class="flex flex-col gap-2">
            <h3 class="text-sm font-medium text-highlighted sm:px-2">
              {{ words.corporate.forYear(entry.taxYear)
              }}<span class="font-normal text-muted">, <MoneyText :cents="entry.paid" /> {{ words.corporate.paidOf }} <MoneyText :cents="entry.expected" /></span>
            </h3>
            <CitObligationList :lines="entry.lines" :test-id="`corporate-tax-${entry.taxYear}`" />
          </section>
        </div>
      </template>
    </AppCard>

    <AppCard
      id="payroll-cadence"
      :title="words.cadence.title"
      collapse-id="year.payroll-cadence"
      :summary="taxes.cadenceSummary"
      start-collapsed
      :reveal="taxes.missed > 0 || route.hash === '#payroll-cadence'"
      data-testid="payroll-cadence"
    >
      <template #subtitle>
        {{ words.cadence.subtitle }}
        <DrillLink to="/company/salaries" in-prose class="text-highlighted" data-testid="payroll-cadence-salaries">{{ words.cadence.salaries }}</DrillLink
        >{{ words.cadence.salariesChecks }}
      </template>
      <p v-if="taxes.cadences.length === 0" class="px-5 py-8 text-sm text-muted">{{ words.cadence.none }}</p>
      <div v-else class="flex flex-col gap-6 px-4 pt-3 pb-4 sm:px-5">
        <section v-for="cadence in taxes.cadences" :key="cadence.category" :aria-label="cadence.name" class="flex flex-col gap-3">
          <h3 class="text-sm font-medium text-highlighted">{{ words.cadence.since(cadence.name, cadence.since) }}</h3>
          <dl class="grid grid-cols-3 gap-3">
            <div class="min-w-0">
              <dt class="text-xs text-muted">{{ words.cadence.monthsPaid }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="cadence.allRows" :label="words.cadence.paidOfRows(cadence.name, cadence.paid, cadence.elapsed)">
                  <span class="figure">{{ words.cadence.paidOf(cadence.paid, cadence.elapsed) }}</span>
                </DrillLink>
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted">{{ words.cadence.missed }}</dt>
              <dd class="figure text-sm font-medium" :class="cadence.missed === 0 ? 'text-highlighted' : 'text-error'">{{ cadence.missed === 0 ? words.cadence.none2 : cadence.missed }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-xs text-muted">{{ words.cadence.typical }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink v-if="cadence.typical !== null" :to="cadence.allRows" :label="words.cadence.typicalRows(cadence.name)">
                  <MoneyText :cents="cadence.typical" />
                </DrillLink>
                <span v-else>–</span>
              </dd>
            </div>
          </dl>
          <CadenceCalendar :name="cadence.name" :cells="cadence.cells" />
        </section>
      </div>
    </AppCard>

    <AppCard v-if="taxes.ring.parts.length === 0" :title="words.byType.title" :subtitle="taxes.period">
      <p class="px-5 py-8 text-sm text-muted">{{ words.byType.noneIn(year) }}</p>
    </AppCard>
    <DonutCard
      v-else
      :title="words.byType.title"
      :subtitle="words.byType.subtitle(taxes.period)"
      :definition="words.byType.definition"
      :description="taxes.ring.description"
      :parts="taxes.ring.parts"
      :total="formatMoney(taxes.ring.paid)"
      :total-label="words.byType.paidIn(year)"
      data-testid="tax-types"
    >
      <template v-if="taxes.ring.refunds.length > 0" #below>
        <ul class="mt-2 flex flex-col border-t border-default pt-2" data-testid="tax-refunds">
          <li v-for="line in taxes.ring.refunds" :key="line.key" class="aside-row">
            <DrillLink :to="line.to" :label="packWords.figure.openRows(line.label)" class="min-w-0 text-toned">{{ words.byType.less(line.label) }}</DrillLink>
            <MoneyText :cents="line.amount" class="text-highlighted" />
          </li>
          <li class="aside-row font-medium">
            <span class="text-toned">{{ words.paid(settings.bucketLabels.taxes) }}</span>
            <DrillLink :to="taxes.ring.net.to" :label="packWords.figure.openRows(words.paid(settings.bucketLabels.taxes))" data-testid="tax-net">
              <MoneyText :cents="taxes.ring.net.amount" class="text-highlighted" />
            </DrillLink>
          </li>
        </ul>
      </template>
    </DonutCard>

    <DrillChartCard
      :chart="taxes.chart"
      :title="words.byType.byMonth"
      :subtitle="words.byType.byMonthSubtitle(taxes.period)"
      :definition="words.byType.byMonthDefinition"
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
