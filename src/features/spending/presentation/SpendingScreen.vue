<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../filters/application/filterStore'
import { priorEqualPeriod } from '../../filters/domain/periodComparison'
import { periodInWords } from '../../filters/domain/periodInWords'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { useSettings } from '../../settings/application/useSettings'
import { costLabelsInSentence } from '../../settings/domain/profitAndLossLabels'
import { profitAndLossLegend, profitAndLossSeries } from '../../trends/presentation/profitAndLossChart'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { categoryTotals } from '../domain/categoryTotals'
import { costGroups } from '../domain/costGroups'
import type { CostGroup } from '../domain/costGroups'
import { topCounterparties } from '../domain/topCounterparties'
import CostByCategory from './CostByCategory.vue'
import type { CostSection } from './CostByCategory.vue'
import MonthStrip from './MonthStrip.vue'
import PayeeCategories from './PayeeCategories.vue'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()

const spending = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { scoped, window, filters } = current
  const prior = priorEqualPeriod(filters.period, window)
  const groups = costGroups(categoryTotals(scoped, filters.period, window), prior === null ? null : categoryTotals(scoped, prior, window))
  const groupTitle = (key: CostGroup['key']): string =>
    key === 'money-back' ? 'Money back' : settings.value.bucketLabels[key]
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
  <section class="flex flex-col gap-6">
    <PageHeader title="Spending" description="Where the money goes, and who it goes to." />
    <LedgerGate>
      <template v-if="ledger && spending">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <CostByCategory
            :sections="spending.sections"
            :subtitle="spending.priorLabel === null ? 'No earlier period to compare' : `Against ${spending.priorLabel}`"
            :definition="spending.definition"
            :legend="spending.legend"
            :compared="spending.priorLabel !== null"
          />

          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
            <header class="px-4 pt-4 sm:px-5">
              <h2 class="text-sm font-medium text-highlighted">Who the company paid most</h2>
              <p class="mt-0.5 text-xs text-muted">Money out only, grouped by IBAN or name.</p>
            </header>
            <p v-if="spending.payees.length === 0" class="px-5 py-8 text-sm text-muted">Nothing left the company in this period.</p>
            <div v-else class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
              <table class="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th scope="col" class="text-start">Counterparty</th>
                    <th scope="col" class="hidden sm:table-cell"><span class="sr-only">The last 12 months</span></th>
                    <th scope="col" class="text-end">Rows</th>
                    <th scope="col" class="text-end">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="payee in spending.payees" :key="payee.key">
                    <th scope="row" class="w-full text-start font-normal">
                      <div class="flex max-w-36 min-w-0 flex-col gap-1 sm:max-w-60">
                        <DrillLink :to="payee.to" class="min-w-0 text-highlighted"><span class="block truncate">{{ payee.label }}</span></DrillLink>
                        <PayeeCategories :payee="payee.label" :categories="payee.categories">
                          <UBadge v-if="payee.rhythm" :label="payee.rhythm" color="neutral" variant="subtle" size="sm" class="shrink-0" />
                        </PayeeCategories>
                      </div>
                    </th>
                    <td class="hidden sm:table-cell"><MonthStrip :cells="payee.strip" :scale="spending.stripScale" /></td>
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
          </section>
        </div>
      </template>
    </LedgerGate>
  </section>
</template>
