<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../filters/application/filterStore'
import { priorEqualPeriod } from '../../filters/domain/periodComparison'
import { periodInWords } from '../../filters/domain/periodInWords'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence } from '../../settings/domain/profitAndLossLabels'
import { profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { categoryTotals } from '../domain/categoryTotals'
import { costGroups } from '../domain/costGroups'
import type { CostGroup } from '../domain/costGroups'
import { topCounterparties } from '../domain/topCounterparties'
import CostByCategory from './CostByCategory.vue'
import type { CostSection } from './CostByCategory.vue'
import MonthStrip from './MonthStrip.vue'
import PayeeCategories from './PayeeCategories.vue'

/** Where the money goes in the period: cost by category and who the company paid most. */
const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

/** The pages that break the taxes and the owner pay further down, in the Croatian pack. */
const GROUP_LINKS = {
  taxes: { label: 'Year, Taxes', to: { path: '/year', query: { tab: 'taxes' } } },
  'owner-pay': { label: 'Owner, Taken', to: { path: '/owner', query: { tab: 'taken' } } },
} as const

const spending = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { scoped, profitAndLossRows, window, filters } = current
  const prior = priorEqualPeriod(filters.period, window)
  const groups = costGroups(categoryTotals(profitAndLossRows, filters.period, window), prior === null ? null : categoryTotals(profitAndLossRows, prior, window))
  const groupTitle = (key: CostGroup['key']): string =>
    key === 'money-back' ? 'Money back' : settings.value.bucketLabels[key]
  const pack = settings.value.ownerPayModule
  const priorLabel = prior === null ? null : periodInWords(prior, window)
  const payees = topCounterparties(scoped, filters.period, window)
  const stripScale = Math.max(0, ...payees.flatMap((payee) => payee.strip.map((cell) => cell.amount)))
  const costLabels = costLabelsInSentence(settings.value)
  return {
    definition: `${costLabels.charAt(0).toUpperCase()}${costLabels.slice(1)} by category. A refund in a cost category lowers its bar. Transfers and reimbursements are not costs, so they are left out.`,
    legend: [
      ...profitAndLossLegend(profitAndLossSeries(settings.value).filter((series) => series.line !== 'income')),
      ...(priorLabel === null ? [] : [{ label: 'Period before', colour: 'var(--chart-ink-muted)', mark: 'outline' as const }]),
    ],
    sections: groups.map(
      (group): CostSection => ({
        key: group.key,
        title: groupTitle(group.key),
        ...(pack && group.key in GROUP_LINKS ? { link: GROUP_LINKS[group.key as keyof typeof GROUP_LINKS] } : {}),
        total: group.total,
        priorTotal: group.priorTotal,
        change: group.change,
        lines: group.rows.map((row) => ({
          key: row.category,
          name: names.value.category(row.category),
          colour: `var(--bucket-${bucketTone(row.bucket)})`,
          current: row.current?.amount ?? 0,
          prior: row.prior?.amount ?? null,
          change: row.change,
          to: row.current === null ? (row.prior === null ? null : drillLocation(row.prior.drill)) : drillLocation(row.current.drill),
        })),
      }),
    ),
    priorLabel,
    stripScale,
    payeesSummary:
      payees[0] === undefined
        ? 'Nothing left the company in this period'
        : `Top: ${payees[0].label}, ${formatWholeMoney(payees[0].total.amount)}, of ${payees.length} ${payees.length === 1 ? 'counterparty' : 'counterparties'}`,
    payees: payees.map((payee) => ({
      key: payee.key,
      label: payee.label,
      to: drillLocation(payee.total.drill),
      total: payee.total.amount,
      count: payee.transactionCount,
      strip: payee.strip,
      rhythm: payee.rhythm === 'monthly' ? 'Monthly' : payee.rhythm === 'one-off' ? 'One-off' : null,
      categories: payee.categories.map((part) => ({
        category: part.category,
        bucket: part.bucket,
        amount: part.amount.amount,
        count: part.transactionCount,
        to: drillLocation(part.amount.drill),
      })),
    })),
  }
})
</script>

<template>
  <div v-if="spending" class="flex flex-col gap-6">
    <CostByCategory
      :sections="spending.sections"
      :subtitle="spending.priorLabel === null ? 'No earlier period to compare' : `Against ${spending.priorLabel}`"
      :definition="spending.definition"
      :legend="spending.legend"
      :compared="spending.priorLabel !== null"
    />

    <AppCard
      title="Who the company paid most"
      subtitle="Money out only, grouped by IBAN or name."
      collapse-id="analysis.payees"
      :summary="spending.payeesSummary"
      start-collapsed
      data-testid="top-payees"
    >
      <p v-if="spending.payees.length === 0" class="px-5 py-8 text-sm text-muted">Nothing left the company in this period.</p>
      <div v-else class="@container relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
        <table class="data-table w-full text-sm">
          <thead>
            <tr>
              <th scope="col" class="text-start">Counterparty</th>
              <th scope="col" class="hidden @lg:table-cell"><span class="sr-only">The last 12 months</span></th>
              <th scope="col" class="text-end">Rows</th>
              <th scope="col" class="text-end">Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payee in spending.payees" :key="payee.key">
              <th scope="row" class="cell-wraps w-full text-start font-normal">
                <div class="payee-cell flex flex-col gap-1">
                  <DrillLink :to="payee.to" class="min-w-0 text-highlighted"><span class="block break-words">{{ payee.label }}</span></DrillLink>
                  <PayeeCategories :payee="payee.label" :categories="payee.categories">
                    <UBadge v-if="payee.rhythm" :label="payee.rhythm" color="neutral" variant="subtle" size="sm" class="shrink-0" />
                  </PayeeCategories>
                </div>
              </th>
              <td class="hidden @lg:table-cell"><MonthStrip :cells="payee.strip" :scale="spending.stripScale" /></td>
              <td class="figure text-end text-muted">{{ payee.count }}</td>
              <td class="text-end">
                <DrillLink :to="payee.to" :label="`${payee.label}, open the rows`">
                  <MoneyText :cents="payee.total" precision="whole" />
                </DrillLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AppCard>
  </div>
</template>

<style scoped>
/* The name takes the width the other columns leave, wrapping a long name and cutting a long chip short, rather than widening the table. */
.payee-cell {
  width: 0;
  min-width: 100%;
}
</style>
