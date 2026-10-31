<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { civilDate, daysBetween, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { LedgerWindow } from '../../../../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../../filters/application/filterStore'
import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { ASSET_WRITES, GRANT_WRITES } from '../../domain/hrDooWrites'
import { GRANT_COLUMNS, assetColumns } from '../editorColumns'
import FactTabCard from '../../../../settings/presentation/FactTabCard.vue'
import type { Asset, AssetGroup } from '../../domain/assets/assets'
import type { Grant } from '../../domain/grants/grants'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import { assetOfFields, readAssets } from '../../domain/assets/assetsReading'
import { grantOfFields, readGrants } from '../../domain/grants/grantsReading'
import type { RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import EmptyState from '../../../../../../shared/ui/EmptyState.vue'
import { ruleValue } from '../../ruleset/ruleset'
import { ruleLink } from '../../ruleset/presentation/ruleWording'
import { assetBooks, depreciationByYear, doubledRatesEffect } from '../../domain/assets/assetBooks'
import { assetRegister } from '../../domain/assets/assetRegister'
import { accumulatedDepreciationOn, bookValueOn } from '../../domain/assets/depreciationSchedule'
import type { DepreciationSchedule } from '../../domain/assets/depreciationSchedule'
import { effectiveTaxRate } from '../../domain/effectiveTaxRate'
import { clawbackExposure, deferredOn, grantResiduals } from '../../domain/grants/grantRelease'
import type { GrantReleaseSchedule } from '../../domain/grants/grantRelease'
import { PACK_ROLES, categoriesWithRole } from '../../domain/packRoles'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { bookValueChart } from './assetCharts'
import AssetRegister from './AssetRegister.vue'
import type { AssetLine } from './AssetRegister.vue'
import DepreciationYears from './DepreciationYears.vue'
import type { DepreciationYearLine } from './DepreciationYears.vue'
import DoubledRatesChanges from './DoubledRatesChanges.vue'
import GrantPanel from './GrantPanel.vue'
import type { GrantComparisonLine, GrantLine } from './GrantPanel.vue'
import { plural } from '../../../../../../shared/text/translation'
import { words } from './words'

/**
 * What the company owns, what it is worth today and what it costs in the year, with any grant that
 * paid for it, and the assets and grants tabs to edit. Book values and the grant still deferred are
 * as of today, whatever the year.
 */
const props = defineProps<{
  workbook: HrDooWorkbook
  window: LedgerWindow
  year: number
}>()

const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const GROUPS: Readonly<Record<AssetGroup, string>> = words.groups

const grantSlugs = computed(() => props.workbook.grants.map((grant) => grant.slug))
const readAssetRows = (records: RecordsRead<Asset>) => readAssets(records, new Set(grantSlugs.value))

const now = new Date()
const today = civilDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
const thisYear = yearOf(today)
const thisMonth = monthLabel(monthOf(today))

/** The doubled rates live in the address only, so a reload or a shared link keeps them and nothing is written. */
const doubledAsked = computed(() => route.query.rates === 'doubled')

function showDoubled(on: boolean): void {
  void router.replace({ query: { ...route.query, rates: on ? 'doubled' : undefined } })
}

const view = computed(() => {
  if (props.workbook.assets.length === 0) {
    return null
  }
  try {
    return { failure: null, ...assetsView(props.workbook, props.window, props.year) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { failure: failure.message }
    }
    throw failure
  }
})

function when(year: number): 'past' | 'current' | 'ahead' {
  return year < thisYear ? 'past' : year === thisYear ? 'current' : 'ahead'
}

function assetsView(workbook: HrDooWorkbook, window: LedgerWindow, year: number) {
  const { assets, grants, categories, transactions } = workbook
  const asWorkbook = assetBooks(assets, grants, workbook.companyFacts)
  const revenueOf = (year: number) => effectiveTaxRate(transactions, categories, { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } }, window).revenue.amount
  const effect = doubledRatesEffect(assets, grants, asWorkbook, revenueOf)
  const doubled = doubledAsked.value && effect.changesAnything
  const shown = doubled ? effect.doubled : asWorkbook
  const register = assetRegister(assets, transactions, categories)
  const threshold = ruleValue('hr.cit.asset-threshold', civilDate(thisYear, 1, 1)).value.unitCostAbove.cents
  const doublingAllowed = ruleValue('hr.cit.depreciation-rates', civilDate(thisYear, 1, 1)).value.doublingAllowed.holds

  const lines = shown.schedules.map((schedule, index) => assetLine(schedule, register.assets[index]?.payment?.drill ?? null))
  const years = depreciationByYear(shown.schedules)
  const yearsDepreciation = years.find((entry) => entry.year === year)?.total.amount ?? 0
  const bookValue = lines.reduce((total, line) => total + line.bookValue, 0)
  const grantLines = shown.grants.map(grantLine)
  const deferredToday = shown.grants.reduce((total, schedule) => total + deferredOn(schedule, today).amount, 0)
  const releasedInYear = shown.grants.reduce((total, schedule) => total + (schedule.years.find((entry) => entry.year === year)?.released.amount ?? 0), 0)
  const exposures = grants.flatMap((grant) => {
    const exposure = clawbackExposure(grant, today)
    return exposure === null ? [] : [exposure.amount.amount]
  })
  const firstCondition = grants.flatMap((grant) => (grant.employmentRequiredUntil !== null && grant.employmentRequiredUntil >= today ? [grant.employmentRequiredUntil] : [])).sort()[0]
  const chart = bookValueChart(shown.schedules, today, chartTokens())
  const unmatchedAssets = register.assets.filter((entry) => entry.payment === null).map((entry) => entry.asset.name)
  const held = lines.filter((line) => line.gone === null).length

  return {
    doubled,
    changesAnything: effect.changesAnything,
    doublingAllowed,
    tiles: [
      {
        label: words.tiles.bookValue,
        value: formatMoney(bookValue),
        to: null,
        caption: plural(words.tiles.onTheBooks(held, lines.length), lines.length),
        definition: words.tiles.bookValueDefinition,
      },
      {
        label: words.tiles.depreciationIn(year),
        value: formatMoney(yearsDepreciation),
        to: ruleLink('hr.cit.depreciation-rates'),
        caption: doubled ? words.tiles.atDoubled : words.tiles.atWorkbookRates,
        definition: words.tiles.depreciationDefinition,
      },
      ...(grants.length === 0
        ? []
        : [
            {
              label: words.tiles.deferred,
              value: formatMoney(deferredToday),
              to: null,
              caption: words.tiles.deferredCaption(formatMoney(releasedInYear), year),
              definition: words.tiles.deferredDefinition,
            },
            {
              label: words.tiles.clawback,
              value: exposures.length === 0 ? '–' : formatMoney(exposures.reduce((total, amount) => total + amount, 0)),
              to: null,
              caption: firstCondition === undefined ? words.tiles.repaidToday : words.tiles.repaidTodayUntil(dayLabel(firstCondition)),
              definition: words.tiles.clawbackDefinition,
            },
          ]),
    ],
    lines,
    totals: {
      cost: lines.reduce((total, line) => total + line.cost, 0),
      charge: lines.reduce((total, line) => total + (line.charge ?? 0), 0),
      accumulated: lines.reduce((total, line) => total + line.accumulated, 0),
      bookValue,
    },
    registerSummary: words.registerSummary(plural(words.assets(lines.length), lines.length), formatMoney(bookValue)),
    unmatchedAssets,
    unmatchedPurchases: register.unmatchedPurchases.map((purchase) => ({
      key: `${purchase.row.account}-${purchase.row.sequence}`,
      date: dayLabel(purchase.row.date),
      counterparty: purchase.row.counterparty || purchase.row.description,
      amount: purchase.row.amount,
      to: drillLocation(purchase.drill),
    })),
    mismatchedPayments: register.mismatchedPayments.map((payment) => ({
      key: `${payment.row.account}-${payment.row.sequence}`,
      date: dayLabel(payment.row.date),
      claimedBy: words.claimedBy(payment.assets.map((asset) => asset.name).join(', '), formatMoney(payment.costNet)),
      amount: payment.row.amount,
      to: drillLocation(payment.drill),
    })),
    threshold: formatMoney(threshold),
    chart,
    bookValueSummary: words.bookValueSummary(plural(words.assets(lines.length), lines.length), formatMoney(bookValue)),
    yearsSummary: years.length === 0 ? words.noDepreciation : plural(words.yearsSummary(years.length, years[0]!.year, years[years.length - 1]!.year), years.length),
    years: years.map((entry): DepreciationYearLine => ({
      year: entry.year,
      total: entry.total.amount,
      when: when(entry.year),
      charges: entry.byAsset.map((charge, index) => {
        const months = charge.schedule.months.filter((month) => month.month.startsWith(`${entry.year}-`)).length
        return {
          key: `${charge.schedule.asset.id}-${index}`,
          asset: charge.schedule.asset.name,
          basis: plural(words.chargeBasis(months, percentText(charge.year.rate), charge.year.doubled), months),
          amount: charge.year.charge.amount,
          deductible: charge.year.deductible.amount < charge.year.charge.amount ? charge.year.deductible.amount : null,
        }
      }),
    })),
    grants: grantLines,
    comparisons: grantResiduals(shown.grants, workbook.yearEndLines).flatMap((check): GrantComparisonLine[] => [
      ...(check.released === null
        ? []
        : [
            {
              key: `${check.year}-released`,
              label: words.releasedIn(check.year),
              accountant: check.released.accountant.amount,
              ours: check.released.ours.amount,
              residual: check.released.residual.amount,
            },
          ]),
      ...(check.deferred === null
        ? []
        : [
            {
              key: `${check.year}-deferred`,
              label: words.deferredAtEnd(check.year),
              accountant: check.deferred.accountant.amount,
              ours: check.deferred.ours.amount,
              residual: check.deferred.residual.amount,
            },
          ]),
    ]),
    changes: effect.years.map((entry) => ({
      year: entry.year,
      depreciation: entry.depreciation.amount,
      grantReleased: entry.grantReleased.amount,
      profitBeforeTax: entry.profitBeforeTax.amount,
      profitTax: entry.profitTax.amount,
      rate: percentText(entry.rate),
    })),
    changesGrant: effect.years.some((entry) => entry.grantReleased.amount !== 0),
  }

  function assetLine(schedule: DepreciationSchedule, paymentDrill: DrillTarget | null): AssetLine {
    const { asset } = schedule
    const yearNow = schedule.years.find((entry) => entry.year === year)
    const rateYear = yearNow ?? schedule.years.at(-1)
    const bookValueToday = bookValueOn(schedule, today).amount
    const lastMonth = schedule.months.at(-1)?.month
    const gone =
      schedule.writeOff !== null && schedule.writeOff.on <= today
        ? (schedule.treatment === 'small-inventory' ? words.writtenOff : words.disposed)(dayLabel(schedule.writeOff.on))
        : bookValueToday === 0 && asset.bought <= today && lastMonth !== undefined
          ? words.writtenOffBy(monthLabel(lastMonth))
          : null
    return {
      key: asset.id,
      name: asset.name,
      payment: paymentDrill === null ? null : drillLocation(paymentDrill),
      bought: dayLabel(asset.bought),
      inUse: dayLabel(asset.inUse),
      cost: asset.costNet,
      group: GROUPS[asset.group],
      rate: schedule.treatment === 'small-inventory' || rateYear === undefined ? words.smallInventory : words.rate(percentText(rateYear.rate), rateYear.doubled),
      rateLink: ruleLink(schedule.treatment === 'small-inventory' ? 'hr.cit.asset-threshold' : 'hr.cit.depreciation-rates'),
      charge: yearNow?.charge.amount ?? null,
      accumulated: accumulatedDepreciationOn(schedule, today).amount,
      bookValue: bookValueToday,
      gone,
      fundedBy: asset.fundedBy === '' ? null : asset.fundedBy,
    }
  }

  function grantLine(schedule: GrantReleaseSchedule): GrantLine {
    const { grant } = schedule
    const exposure = clawbackExposure(grant, today)
    return {
      key: grant.slug,
      name: grant.slug,
      received: dayLabel(grant.received),
      receipt: receiptOf(grant),
      amount: grant.amount,
      policy: schedule.policy === 'fixed-then-assets' ? words.fixedThenAssets : words.straightLine(grant.period === null ? null : words.span(dayLabel(grant.period.from), dayLabel(grant.period.to))),
      employmentUntil: grant.employmentRequiredUntil === null ? null : dayLabel(grant.employmentRequiredUntil),
      employmentState: employmentState(grant.employmentRequiredUntil),
      clawback: exposure === null ? null : { amount: exposure.amount.amount, until: exposure.until === null ? null : dayLabel(exposure.until) },
      years: schedule.years.map((entry) => ({ year: entry.year, released: entry.released.amount, deferred: entry.deferredAtYearEnd.amount, when: when(entry.year) })),
      neverReleased: schedule.neverReleased.amount,
    }
  }

  function receiptOf(grant: Grant) {
    const grantCategories = categoriesWithRole(categories, PACK_ROLES.grant)
    return grantCategories.length === 0 ? null : drillLocation(drillToTransactions({ period: { preset: 'custom', range: { from: grant.received, to: grant.received } }, categories: grantCategories }))
  }
}

function employmentState(until: CivilDate | null): string | null {
  if (until === null) {
    return null
  }
  const days = daysBetween(today, until)
  if (days > 0) {
    return plural(words.daysToGo(days), days)
  }
  return days === 0 ? words.lastDayToday : words.periodOver
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState v-if="workbook.assets.length === 0" icon="i-lucide-package" :title="words.panel.emptyTitle" :description="words.panel.emptyDescription" data-testid="assets-empty" />
    <EmptyState v-else-if="view && view.failure !== null" icon="i-lucide-triangle-alert" :title="words.panel.failed" :description="view.failure" tone="error" />
    <template v-else-if="view && view.failure === null">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8" data-testid="doubled-rates">
        <USwitch
          :model-value="view.doubled"
          :disabled="!view.changesAnything"
          :label="words.panel.showDoubled"
          :description="view.changesAnything ? words.panel.doubledChanges : view.doublingAllowed ? words.panel.alreadyDoubled : words.panel.noDoubling"
          data-testid="doubled-rates-switch"
          @update:model-value="showDoubled($event)"
        />
        <p v-if="view.doublingAllowed" class="max-w-[60ch] text-xs text-muted">
          {{ words.panel.doublingAllowed }}
          <DrillLink :to="ruleLink('hr.cit.depreciation-rates')" in-prose class="text-highlighted">{{ words.panel.openRule }}</DrillLink>
        </p>
      </div>

      <AppCard v-if="view.doubled" :title="words.panel.changesTitle" :subtitle="words.panel.changesSubtitle">
        <div class="flex flex-col gap-2 px-4 pt-2 pb-4 sm:px-5">
          <p v-if="view.changesGrant" class="max-w-[75ch] text-xs text-muted">
            {{ words.panel.changesGrant }}
          </p>
          <DoubledRatesChanges :lines="view.changes" :show-grant="view.changesGrant" />
        </div>
      </AppCard>

      <DashboardGrid layout="tiles">
        <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
      </DashboardGrid>

      <AppCard :title="words.panel.registerTitle" :subtitle="words.panel.registerSubtitle" collapse-id="year.asset-register" :summary="view.registerSummary">
        <div class="px-4 pt-3 pb-3 sm:px-3">
          <AssetRegister :lines="view.lines" :totals="view.totals" :year="year" :today="dayLabel(today)" />
        </div>
        <div
          v-if="view.unmatchedAssets.length > 0 || view.unmatchedPurchases.length > 0 || view.mismatchedPayments.length > 0"
          class="flex flex-col gap-3 border-t border-default px-4 py-3 sm:px-5"
          data-testid="asset-notices"
        >
          <div v-if="view.unmatchedAssets.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-search-x" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>{{ words.panel.noPaymentBefore(view.unmatchedAssets.join(', ')) }}<span class="identifier">ledger_reference</span>{{ words.panel.noPaymentAfter }}</p>
          </div>
          <div v-if="view.unmatchedPurchases.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-package-search" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p>
                {{ plural(words.panel.unmatchedPurchases(view.unmatchedPurchases.length, view.threshold), view.unmatchedPurchases.length) }}
              </p>
              <ul class="flex flex-col" data-testid="unmatched-purchases">
                <li v-for="purchase in view.unmatchedPurchases" :key="purchase.key">
                  <DrillLink :to="purchase.to" :label="words.panel.purchaseRow(purchase.counterparty, purchase.date)" class="purchase-link">
                    <span class="figure shrink-0 text-xs text-muted">{{ purchase.date }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ purchase.counterparty }}</span>
                    <MoneyText :cents="purchase.amount" class="text-toned" />
                  </DrillLink>
                </li>
              </ul>
            </div>
          </div>
          <div v-if="view.mismatchedPayments.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-scale" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p>
                {{ plural(words.panel.mismatchedBefore(view.mismatchedPayments.length), view.mismatchedPayments.length) }}<span class="identifier">ledger_reference</span
                >{{ words.panel.mismatchedAfter(view.mismatchedPayments.length) }}<span class="identifier">cost_net</span>.
              </p>
              <ul class="flex flex-col" data-testid="mismatched-payments">
                <li v-for="payment in view.mismatchedPayments" :key="payment.key">
                  <DrillLink :to="payment.to" :label="words.panel.paymentRow(payment.date)" class="purchase-link">
                    <span class="figure shrink-0 text-xs text-muted">{{ payment.date }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ payment.claimedBy }}</span>
                    <MoneyText :cents="payment.amount" class="text-toned" />
                  </DrillLink>
                </li>
              </ul>
            </div>
          </div>
          <DrillLink :to="{ query: route.query, hash: '#asset-rows' }" in-prose class="self-start text-sm text-highlighted">{{ words.panel.openAssetRows }}</DrillLink>
        </div>
      </AppCard>

      <AppCard :title="words.panel.grantTitle" :subtitle="words.panel.grantSubtitle">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <GrantPanel :grants="view.grants" :comparisons="view.comparisons" />
        </div>
      </AppCard>

      <ChartCard
        :title="words.panel.bookValueTitle"
        :subtitle="words.panel.bookValueSubtitle(thisMonth)"
        :definition="words.panel.bookValueDefinition"
        :option="view.chart.option"
        :description="view.chart.description"
        :empty="view.chart.empty"
        :empty-title="words.panel.noDepreciation"
        :empty-description="words.panel.allSmallInventory"
        :height="300"
        :phone-height="240"
        collapse-id="year.book-value"
        :summary="view.bookValueSummary"
        start-collapsed
      >
        <template #legend><ChartLegend :entries="view.chart.legend" /></template>
      </ChartCard>

      <AppCard :title="words.panel.perYearTitle" :subtitle="words.panel.perYearSubtitle" collapse-id="year.depreciation" :summary="view.yearsSummary" start-collapsed>
        <div class="px-4 pt-2 pb-2 sm:px-5">
          <p v-if="view.years.length === 0" class="py-6 text-sm text-muted">{{ words.panel.noDepreciationNote }}</p>
          <DepreciationYears v-else :key="String(view.doubled)" :years="view.years" />
        </div>
      </AppCard>
    </template>

    <FactTabCard
      id="asset-rows"
      :rules="ASSET_WRITES"
      :title="words.panel.assetRows"
      :description="words.panel.assetRowsDescription"
      collapse-id="year.asset-rows"
      :columns="assetColumns(grantSlugs)"
      :read="readAssetRows"
      :make="assetOfFields"
      :saved-title="words.panel.assetsSaved"
      :start-collapsed="workbook.assets.length > 0"
      :reveal="route.hash === '#asset-rows'"
    />
    <FactTabCard
      id="grant-rows"
      :rules="GRANT_WRITES"
      :title="words.panel.grantRows"
      :description="words.panel.grantRowsDescription"
      collapse-id="year.grant-rows"
      :columns="GRANT_COLUMNS"
      :read="readGrants"
      :make="grantOfFields"
      :new-row="() => ({ release: 'fixed-then-assets' })"
      :saved-title="words.panel.grantsSaved"
      start-collapsed
      :reveal="route.hash === '#grant-rows'"
    />
  </div>
</template>

<style scoped>
.purchase-link {
  display: flex;
  width: 100%;
  align-items: baseline;
  gap: 0.75rem;
  padding-block: 0.25rem;
}
</style>
