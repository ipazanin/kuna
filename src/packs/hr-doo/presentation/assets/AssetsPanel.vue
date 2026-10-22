<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { civilDate, daysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { formatMoney, formatWholeMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../../features/filters/application/filterStore'
import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import { ASSET_ROWS, GRANT_ROWS } from '../../../../features/settings/application/workbookTabRows'
import { GRANT_COLUMNS, assetColumns } from '../../../../features/settings/presentation/factTabColumns'
import FactTabCard from '../../../../features/settings/presentation/FactTabCard.vue'
import type { AssetGroup } from '../../../../features/workbook/domain/assets'
import type { Grant } from '../../../../features/workbook/domain/grants'
import type { Workbook } from '../../../../features/workbook/domain/workbook'
import { readAssets } from '../../../../features/workbook/infrastructure/assetsTabReader'
import { readGrants } from '../../../../features/workbook/infrastructure/grantsTabReader'
import type { SheetRow } from '../../../../features/workbook/infrastructure/workbookSnapshot'
import { ruleValue } from '../../ruleset/ruleset'
import { dayLabel, ruleLink } from '../../ruleset/presentation/ruleWording'
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

/**
 * What the company owns, what it is worth today and what it costs in the year, with any grant that
 * paid for it, and the assets and grants tabs to edit. Book values and the grant still deferred are
 * as of today, whatever the year.
 */
const props = defineProps<{
  workbook: Workbook
  window: LedgerWindow
  year: number
}>()

const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const GROUPS: Readonly<Record<AssetGroup, string>> = {
  computers: 'Computers',
  equipment: 'Equipment',
  car: 'Car',
  building: 'Building',
  other: 'Other',
}

const grantSlugs = computed(() => props.workbook.grants.map((grant) => grant.slug))
const readAssetRows = (rows: readonly SheetRow[]) => readAssets(rows, new Set(grantSlugs.value))

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

function assetsView(workbook: Workbook, window: LedgerWindow, year: number) {
  const { assets, grants, categories, transactions } = workbook
  const asWorkbook = assetBooks(assets, grants, workbook.settings.companyFacts)
  const revenueOf = (year: number) =>
    effectiveTaxRate(transactions, categories, { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year, 12, 31) } }, window).revenue.amount
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
        label: 'Book value',
        value: formatWholeMoney(bookValue),
        to: null,
        caption: `Today, ${held} of ${lines.length} ${lines.length === 1 ? 'asset' : 'assets'} on the books`,
        definition: 'Cost without VAT less the depreciation of every month that has ended. Small inventory is written off when put in use, so it carries no book value.',
      },
      {
        label: `Depreciation in ${year}`,
        value: formatWholeMoney(yearsDepreciation),
        to: ruleLink('hr.cit.depreciation-rates'),
        caption: doubled ? 'At doubled rates' : 'At the rates the workbook asks for',
        definition: 'Straight-line from the month after an asset is put in use, at its group rate. Opens the rule with the rates.',
      },
      ...(grants.length === 0
        ? []
        : [
            {
              label: 'Deferred',
              value: formatWholeMoney(deferredToday),
              to: null,
              caption: `Grant not yet income today. ${formatWholeMoney(releasedInYear)} released in ${year}`,
              definition: 'Grant money received and not yet counted as income, as of the last month that has ended.',
            },
            {
              label: 'Clawback',
              value: exposures.length === 0 ? '–' : formatWholeMoney(exposures.reduce((total, amount) => total + amount, 0)),
              to: null,
              caption:
                firstCondition === undefined
                  ? 'Repaid if employment ended today'
                  : `Repaid if employment ended today. Required until ${dayLabel(firstCondition)}`,
              definition: "What the grantor could claim back if a condition broke today, from the clawback terms on the grants tab. It is a risk to plan for, never a figure in profit.",
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
    registerSummary: `${lines.length} ${lines.length === 1 ? 'asset' : 'assets'}, ${formatWholeMoney(bookValue)} book value today`,
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
      claimedBy: `${payment.assets.map((asset) => asset.name).join(', ')}, ${formatMoney(payment.costNet)} without VAT`,
      amount: payment.row.amount,
      to: drillLocation(payment.drill),
    })),
    threshold: formatMoney(threshold),
    chart,
    bookValueSummary: `${lines.length} ${lines.length === 1 ? 'asset' : 'assets'}, ${formatWholeMoney(bookValue)} today`,
    yearsSummary: years.length === 0 ? 'No asset is depreciated' : `${years.length} ${years.length === 1 ? 'year' : 'years'}, ${years[0]!.year} to ${years[years.length - 1]!.year}`,
    years: years.map(
      (entry): DepreciationYearLine => ({
        year: entry.year,
        total: entry.total.amount,
        when: when(entry.year),
        charges: entry.byAsset.map((charge, index) => {
          const months = charge.schedule.months.filter((month) => month.month.startsWith(`${entry.year}-`)).length
          return {
            key: `${charge.schedule.asset.sheetRow}-${index}`,
            asset: charge.schedule.asset.name,
            basis: `${months} ${months === 1 ? 'month' : 'months'} at ${percentText(charge.year.rate)}${charge.year.doubled ? ', doubled' : ''}`,
            amount: charge.year.charge.amount,
            deductible: charge.year.deductible.amount < charge.year.charge.amount ? charge.year.deductible.amount : null,
          }
        }),
      }),
    ),
    grants: grantLines,
    comparisons: grantResiduals(shown.grants, workbook.yearEndLines).flatMap((check): GrantComparisonLine[] => [
      ...(check.released === null
        ? []
        : [{ key: `${check.year}-released`, label: `Released in ${check.year}`, accountant: check.released.accountant.amount, ours: check.released.ours.amount, residual: check.released.residual.amount }]),
      ...(check.deferred === null
        ? []
        : [{ key: `${check.year}-deferred`, label: `Deferred at the end of ${check.year}`, accountant: check.deferred.accountant.amount, ours: check.deferred.ours.amount, residual: check.deferred.residual.amount }]),
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
        ? `${schedule.treatment === 'small-inventory' ? 'Written off' : 'Disposed'} ${dayLabel(schedule.writeOff.on)}`
        : bookValueToday === 0 && asset.bought <= today && lastMonth !== undefined
          ? `Written off by ${monthLabel(lastMonth)}`
          : null
    return {
      key: `${asset.sheetRow}`,
      name: asset.name,
      payment: paymentDrill === null ? null : drillLocation(paymentDrill),
      bought: dayLabel(asset.bought),
      inUse: dayLabel(asset.inUse),
      cost: asset.costNet,
      group: GROUPS[asset.group],
      rate:
        schedule.treatment === 'small-inventory' || rateYear === undefined
          ? 'Small inventory'
          : `${percentText(rateYear.rate)}${rateYear.doubled ? ', doubled' : ''}`,
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
      policy:
        schedule.policy === 'fixed-then-assets'
          ? 'The fixed part counts as income on receipt, and the variable part as the assets it paid for are depreciated.'
          : `Released evenly over the grant period${grant.period === null ? '' : `, ${dayLabel(grant.period.from)} to ${dayLabel(grant.period.to)}`}.`,
      employmentUntil: grant.employmentRequiredUntil === null ? null : dayLabel(grant.employmentRequiredUntil),
      employmentState: employmentState(grant.employmentRequiredUntil),
      clawback: exposure === null ? null : { amount: exposure.amount.amount, until: exposure.until === null ? null : dayLabel(exposure.until) },
      years: schedule.years.map((entry) => ({ year: entry.year, released: entry.released.amount, deferred: entry.deferredAtYearEnd.amount, when: when(entry.year) })),
      neverReleased: schedule.neverReleased.amount,
    }
  }

  function receiptOf(grant: Grant) {
    const grantCategories = categoriesWithRole(categories, PACK_ROLES.grant)
    return grantCategories.length === 0
      ? null
      : drillLocation(drillToTransactions({ period: { preset: 'custom', range: { from: grant.received, to: grant.received } }, categories: grantCategories }))
  }
}

function employmentState(until: CivilDate | null): string | null {
  if (until === null) {
    return null
  }
  const days = daysBetween(today, until)
  if (days > 0) {
    return `${days} ${days === 1 ? 'day' : 'days'} to go`
  }
  return days === 0 ? 'The last required day is today' : 'The required period is over'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UEmpty
      v-if="workbook.assets.length === 0"
      icon="i-lucide-package"
      title="No assets on the assets tab"
      description="The assets tab lists what the company bought to keep, such as a laptop or a car: its cost without VAT, its depreciation group and the day it was put in use. Each row is depreciated here, and a grant that paid for it is released beside it. Add the first one under Asset rows."
      variant="outline"
      class="rounded-card border-dashed bg-raised/40"
      data-testid="assets-empty"
    />
    <UEmpty
      v-else-if="view && view.failure !== null"
      icon="i-lucide-triangle-alert"
      title="The assets could not be depreciated"
      :description="view.failure"
      variant="outline"
      class="rounded-card border-error/40 bg-raised"
      :ui="{ avatar: 'text-error' }"
    />
    <template v-else-if="view && view.failure === null">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-8" data-testid="doubled-rates">
        <USwitch
          :model-value="view.doubled"
          :disabled="!view.changesAnything"
          label="Show doubled rates"
          :description="
            view.changesAnything
              ? 'Every figure on this tab at twice the group rate. Nothing is saved, and the workbook keeps its own setting.'
              : view.doublingAllowed
                ? 'Every asset already depreciates at the doubled rate, from its doubled column or hr_depreciation_doubled.'
                : 'The depreciation rates in force do not allow doubling.'
          "
          data-testid="doubled-rates-switch"
          @update:model-value="showDoubled($event)"
        />
        <p v-if="view.doublingAllowed" class="max-w-[60ch] text-xs text-muted">
          The profit tax act allows each depreciation rate to be doubled. Whether to do it is a choice to discuss with the accountant.
          <DrillLink :to="ruleLink('hr.cit.depreciation-rates')" in-prose class="text-highlighted">Open the rule</DrillLink>
        </p>
      </div>

      <AppCard
        v-if="view.doubled"
        title="What doubled rates would change"
        subtitle="Against the rates the workbook asks for, year by year. More depreciation lowers profit before tax. The profit tax change is the profit change at the corporate tax rate of the year."
      >
        <div class="flex flex-col gap-2 px-4 pt-2 pb-4 sm:px-5">
          <p v-if="view.changesGrant" class="max-w-[75ch] text-xs text-muted">
            A grant released with the depreciation of the assets it paid for rises with it, so those assets change profit only once the grant's variable part runs out.
          </p>
          <DoubledRatesChanges :lines="view.changes" :show-grant="view.changesGrant" />
        </div>
      </AppCard>

      <div class="grid grid-cols-2 gap-3" :class="view.tiles.length === 4 ? 'lg:grid-cols-4' : ''">
        <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
      </div>

      <AppCard
        title="Asset register"
        subtitle="From the assets tab. An asset's name opens the ledger payment that bought it, and its rate opens the rule."
        collapse-id="year.asset-register"
        :summary="view.registerSummary"
      >
        <div class="px-4 pt-3 pb-3 sm:px-3">
          <AssetRegister :lines="view.lines" :totals="view.totals" :year="year" :today="dayLabel(today)" />
        </div>
        <div
          v-if="view.unmatchedAssets.length > 0 || view.unmatchedPurchases.length > 0 || view.mismatchedPayments.length > 0"
          class="flex flex-col gap-3 border-t border-default px-4 py-3 sm:px-5"
          data-testid="asset-notices"
        >
          <div v-if="view.unmatchedAssets.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-search-x" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              No ledger payment found for {{ view.unmatchedAssets.join(', ') }}. Put the bank reference, or words from the bank description, in its
              <span class="identifier">ledger_reference</span> under Asset rows.
            </p>
          </div>
          <div v-if="view.unmatchedPurchases.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-package-search" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p>
                {{ view.unmatchedPurchases.length }} {{ view.unmatchedPurchases.length === 1 ? 'purchase' : 'purchases' }} on a capital-purchase category
                {{ view.unmatchedPurchases.length === 1 ? 'is' : 'are' }} on no asset row. Up to {{ view.threshold }} without VAT an item is small inventory,
                written off when put in use. Above that it belongs on the assets tab.
              </p>
              <ul class="flex flex-col" data-testid="unmatched-purchases">
                <li v-for="purchase in view.unmatchedPurchases" :key="purchase.key">
                  <DrillLink :to="purchase.to" :label="`${purchase.counterparty} on ${purchase.date}, open the row`" class="purchase-link">
                    <span class="figure shrink-0 text-xs text-muted">{{ purchase.date }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ purchase.counterparty }}</span>
                    <MoneyText :cents="purchase.amount" class="text-toned" />
                  </DrillLink>
                </li>
              </ul>
            </div>
          </div>
          <div v-if="view.mismatchedPayments.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-scale" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <p>
                {{ view.mismatchedPayments.length }} {{ view.mismatchedPayments.length === 1 ? 'payment' : 'payments' }} found by a
                <span class="identifier">ledger_reference</span> {{ view.mismatchedPayments.length === 1 ? 'is' : 'are' }} not what the assets that claim
                {{ view.mismatchedPayments.length === 1 ? 'it' : 'them' }} cost, with or without VAT at the standard rate. Check each asset's reference and its
                <span class="identifier">cost_net</span>.
              </p>
              <ul class="flex flex-col" data-testid="mismatched-payments">
                <li v-for="payment in view.mismatchedPayments" :key="payment.key">
                  <DrillLink :to="payment.to" :label="`Payment of ${payment.date}, open the row`" class="purchase-link">
                    <span class="figure shrink-0 text-xs text-muted">{{ payment.date }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ payment.claimedBy }}</span>
                    <MoneyText :cents="payment.amount" class="text-toned" />
                  </DrillLink>
                </li>
              </ul>
            </div>
          </div>
          <DrillLink :to="{ query: route.query, hash: '#asset-rows' }" in-prose class="self-start text-sm text-highlighted">Open the asset rows</DrillLink>
        </div>
      </AppCard>

      <AppCard title="The grant beside it" subtitle="From the grants tab: what is counted as income each year, what waits as deferred income, and the employment condition.">
        <div class="px-4 pt-3 pb-4 sm:px-5">
          <GrantPanel :grants="view.grants" :comparisons="view.comparisons" />
        </div>
      </AppCard>

      <ChartCard
        title="Book value over time"
        :subtitle="`Each asset at the end of every month, until it is written off. Months from ${thisMonth} on follow the schedule.`"
        definition="Cost without VAT less the depreciation of every month so far. A line ends in the month the asset reaches zero or leaves the books."
        :option="view.chart.option"
        :description="view.chart.description"
        :empty="view.chart.empty"
        empty-title="No asset is depreciated"
        empty-description="Every asset on the tab is small inventory, written off when put in use."
        :height="300"
        :phone-height="240"
        collapse-id="year.book-value"
        :summary="view.bookValueSummary"
        start-collapsed
      >
        <template #legend><ChartLegend :entries="view.chart.legend" /></template>
      </ChartCard>

      <AppCard
        title="Depreciation per year"
        subtitle="Every year the assets cover. Open a year for the charge of each asset."
        collapse-id="year.depreciation"
        :summary="view.yearsSummary"
        start-collapsed
      >
        <div class="px-4 pt-2 pb-2 sm:px-5">
          <p v-if="view.years.length === 0" class="py-6 text-sm text-muted">No asset is depreciated. Small inventory is written off when put in use.</p>
          <DepreciationYears v-else :key="String(view.doubled)" :years="view.years" />
        </div>
      </AppCard>
    </template>

    <FactTabCard
      id="asset-rows"
      :rules="ASSET_ROWS"
      title="Asset rows"
      description="Purchases kept as fixed assets and depreciated, each once. The cost is without the VAT that was reclaimed."
      collapse-id="year.asset-rows"
      :columns="assetColumns(grantSlugs)"
      :read="readAssetRows"
      row-noun="asset"
      tab-noun="assets"
      saved-title="Assets saved"
      :start-collapsed="workbook.assets.length > 0"
      :reveal="route.hash === '#asset-rows'"
    />
    <FactTabCard
      id="grant-rows"
      :rules="GRANT_ROWS"
      title="Grant rows"
      description="The terms of each grant. The fixed and variable parts add up to the amount."
      collapse-id="year.grant-rows"
      :columns="GRANT_COLUMNS"
      :read="readGrants"
      :new-row="() => ({ release: 'fixed-then-assets' })"
      row-noun="grant"
      tab-noun="grants"
      saved-title="Grants saved"
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
