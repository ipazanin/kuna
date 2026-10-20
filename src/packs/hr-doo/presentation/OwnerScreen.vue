<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { CivilDate } from '../../../shared/calendar/civilDate'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { currencyUnitName, formatMoney, formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import { periodInWords } from '../../../features/filters/domain/periodInWords'
import { chartedMonths } from '../../../features/filters/domain/periodPresets'
import DrillChartCard from '../../../features/filters/presentation/DrillChartCard.vue'
import FilterBar from '../../../features/filters/presentation/FilterBar.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import LedgerGate from '../../../features/workbook/presentation/LedgerGate.vue'
import { netOwed, ownerAdvances } from '../domain/ownerAdvances'
import { ownerCost } from '../domain/ownerCost'
import { loanMonths, ownerLoans } from '../domain/ownerLoans'
import { ownerTake, ownerTakeByMonth } from '../domain/ownerTake'
import type { OwnerTakeLine } from '../domain/ownerTake'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole } from '../domain/packRoles'
import AddAdvanceDialog from './AddAdvanceDialog.vue'
import type { AdvancePrefill } from './AddAdvanceDialog.vue'
import AdvanceList from './AdvanceList.vue'
import type { AdvanceLine } from './AdvanceList.vue'
import LoanList from './LoanList.vue'
import type { LoanLine } from './LoanList.vue'
import MissingRoles from './MissingRoles.vue'
import OwnerPayOff from './OwnerPayOff.vue'
import UnaccountedReimbursements from './UnaccountedReimbursements.vue'
import { LENT_SERIES, OUTSTANDING_SERIES, REPAID_SERIES, categoryLegend, categorySeries, loanTimelineChart, ownerDrawsChart } from './packCharts'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const names = useDisplayNames()
const { state } = useWorkbook()
const addingAdvance = ref(false)
const advancePrefill = ref<AdvancePrefill | null>(null)

function addAdvance(prefill: AdvancePrefill | null): void {
  advancePrefill.value = prefill
  addingAdvance.value = true
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function day(date: CivilDate): string {
  return dayFormat.format(new Date(date))
}

const owner = computed(() => {
  const current = ledger.value
  if (current === null) {
    return null
  }
  const { workbook, scoped, profitAndLossRows, window, filters } = current
  const { categories } = workbook
  const tokens = chartTokens()
  const categoryName = names.value.category
  const payLabel = settings.value.bucketLabels['owner-pay']
  const months = chartedMonths(filters.period, window)
  const take = ownerTake(profitAndLossRows, categories, filters.period, window)
  const cost = ownerCost(profitAndLossRows, categories, filters.period, window)
  const loans = ownerLoans(current.scopedAdvances, scoped, categories)
  const advances = ownerAdvances(current.scopedAdvances, scoped, categories)
  const owed = netOwed(loans, advances, categories)
  const takeMonths = ownerTakeByMonth(profitAndLossRows, categories, months, window)
  const series = categorySeries(
    categoriesInBucket(categories, 'owner-pay').filter((category) => takeMonths.some((month) => month.byCategory[category]?.amount !== 0)),
    tokens,
    categoryName,
  )
  const colourOf = new Map(series.flatMap((entry) => entry.categories.map((category) => [category, entry.colour])))
  const loanOut = categoriesWithRole(categories, PACK_ROLES.ownerLoanOut)
  const loanRepaid = categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)
  const ownerPayTax = categoriesWithRole(categories, PACK_ROLES.ownerPayTax)
  const reimbursement = categoriesWithRole(categories, PACK_ROLES.reimbursement)
  const hasLoanRoles = loanOut.length > 0 && loanRepaid.length > 0
  const payBuckets = new Set(categoriesInBucket(categories, 'owner-pay'))
  const loansArePay = hasLoanRoles && [...loanOut, ...loanRepaid].every((category) => payBuckets.has(category))
  const loanColours = {
    lent: colourOf.get(loanOut[0] ?? '') ?? tokens.buckets['owner-pay'],
    repaid: colourOf.get(loanRepaid[0] ?? '') ?? tokens.buckets.income,
  }
  const balance = loans.outstanding.amount
  const times = new Intl.NumberFormat(settings.value.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const takeLine = (line: OwnerTakeLine) => ({
    category: line.category,
    name: categoryName(line.category),
    colour: colourOf.get(line.category) ?? 'var(--chart-deemphasis)',
    amount: line.amount.amount,
    to: drillLocation(line.amount.drill),
  })
  return {
    period: periodInWords(filters.period, window),
    payLabel,
    missing: [
      ...(loanOut.length === 0 ? [{ role: PACK_ROLES.ownerLoanOut, leftOut: 'no loan to the owner is listed' }] : []),
      ...(loanRepaid.length === 0 ? [{ role: PACK_ROLES.ownerLoanRepaid, leftOut: 'no repayment is matched to a loan' }] : []),
      ...(ownerPayTax.length === 0 ? [{ role: PACK_ROLES.ownerPayTax, leftOut: 'gross cost is owner pay alone' }] : []),
      ...(reimbursement.length === 0 ? [{ role: PACK_ROLES.reimbursement, leftOut: 'no reimbursement repays an advance' }] : []),
    ],
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
      {
        label: 'Net owed',
        value: formatWholeMoney(owed.amount),
        to: drillLocation(owed.drill),
        caption: owed.amount > 0 ? 'The owner owes the company' : owed.amount < 0 ? 'The company owes the owner' : 'Nothing owed either way',
        definition:
          `All time, one balance across both directions. The owner owes the company what was lent, private costs and private shares of company payments included, ` +
          `less what the owner paid back on a loan or reimbursement category (${formatWholeMoney(owed.loanBalance)}). ` +
          `The company owes the owner the costs the owner paid privately and has not been reimbursed for (${formatWholeMoney(owed.advancesOutstanding)}). ` +
          (advances.unaccountedTotal > 0
            ? `That figure counts the reimbursements with no cost on file (${formatMoney(advances.unaccountedTotal)}) as paid to the owner until their costs are added. `
            : '') +
          'Positive means the owner owes the company. A private cost the company paid in full counts as lent only when its row is in a category with the owner-loan-out role.',
      },
    ],
    draws: ownerDrawsChart(takeMonths, series, tokens),
    drawsEmpty: series.length === 0,
    drawsLegend: [...categoryLegend(series), { label: 'Month so far', colour: 'var(--chart-deemphasis)', mark: 'hatched' as const }],
    takeLines: take.byCategory.map(takeLine),
    takeTotal: { amount: take.total.amount, to: drillLocation(take.total.drill) },
    reimbursements: take.reimbursements.map(takeLine),
    hasLoanRoles,
    timeline: loanTimelineChart(loanMonths(current.scopedAdvances, scoped, categories, months, window), loanColours, tokens),
    timelineLegend: [
      { label: LENT_SERIES, colour: loanColours.lent },
      { label: REPAID_SERIES, colour: loanColours.repaid },
      { label: OUTSTANDING_SERIES, colour: 'var(--chart-ink)', mark: 'line' as const },
    ],
    loanSummary: [
      { label: 'Lent', amount: loans.lent.amount, to: drillLocation(loans.lent.drill) },
      { label: 'Repaid', amount: loans.repaid.amount, to: drillLocation(loans.repaid.drill) },
      { label: 'Still owed', amount: balance, to: drillLocation(loans.outstanding.drill) },
    ],
    advanceSummary: [
      { label: 'Paid by the owner', amount: advances.advanced.amount, to: drillLocation(advances.advanced.drill) },
      { label: 'Reimbursed', amount: advances.reimbursed.amount, to: drillLocation(advances.reimbursed.drill) },
      { label: 'Owed to the owner', amount: advances.outstanding.amount, to: drillLocation(advances.outstanding.drill) },
    ],
    unaccounted: advances.unaccounted,
    advancesSummary: [
      `${advances.advances.length} ${advances.advances.length === 1 ? 'cost' : 'costs'}`,
      `${formatWholeMoney(advances.outstanding.amount)} owed to the owner`,
      ...(advances.unaccounted.length === 0 ? [] : [`${advances.unaccounted.length} ${advances.unaccounted.length === 1 ? 'reimbursement' : 'reimbursements'} with no cost on file`]),
    ].join(', '),
    advances: [...advances.advances].reverse().map(
      (line): AdvanceLine => ({
        key: `${line.advance.sheetRow}`,
        paidOn: day(line.advance.date),
        description: line.advance.description,
        category: categoryName(line.advance.category),
        amount: line.advance.amount,
        to: drillLocation(line.drill),
        remaining: line.remaining,
        open: line.status === 'open',
        repaidOn: line.repaidOn === null ? null : day(line.repaidOn),
        repayments: line.repayments.map((share, shareIndex) => ({
          key: `${share.repaidOn}-${shareIndex}`,
          date: day(share.repaidOn),
          applied: share.applied,
          to: drillLocation(share.drill),
        })),
      }),
    ),
    newestBooking: workbook.transactions.reduce((newest, transaction) => (transaction.date > newest ? transaction.date : newest), workbook.transactions[0]!.date),
    openCount: loans.openCount,
    oldestOpen: loans.oldestOpen === null ? null : day(loans.oldestOpen),
    loans: [...loans.loans].reverse().map(
      (loan, index): LoanLine => ({
        key: `${loan.lentOn}-${index}`,
        lentOn: day(loan.lentOn),
        privateShare: loan.privateShareOf === null ? null : loan.privateShareOf.description || `Private share of a payment filed as ${categoryName(loan.privateShareOf.category)}`,
        amount: loan.amount,
        remaining: loan.remaining,
        open: loan.status === 'open',
        repaidOn: loan.repaidOn === null ? null : day(loan.repaidOn),
        to: drillLocation(loan.drill),
        repayments: loan.repayments.map((share, shareIndex) => ({
          key: `${share.repaidOn}-${shareIndex}`,
          date: day(share.repaidOn),
          applied: share.applied,
          to: drillLocation(share.drill),
        })),
      }),
    ),
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Owner" description="What the owner took out, what it cost, and who owes whom between the owner and the company.">
      <template v-if="settings.ownerPayModule" #actions>
        <UButton label="Compare owner pay mixes" icon="i-lucide-scale" to="/pay-scenarios" color="neutral" variant="outline" size="sm" data-testid="owner-pay-scenarios" />
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && owner">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" />
        <MissingRoles :missing="owner.missing" />

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile v-for="tile in owner.tiles" :key="tile.label" v-bind="tile" />
        </div>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <DrillChartCard
            :chart="owner.draws"
            :title="`${owner.payLabel} by category, by month`"
            :subtitle="`${owner.period}. A repayment stacks below zero.`"
            :empty="owner.drawsEmpty"
            :height="320"
            :phone-height="260"
          >
            <template #legend><ChartLegend :entries="owner.drawsLegend" /></template>
          </DrillChartCard>

          <AppCard title="Owner take by category" :subtitle="`${owner.period}. Paid to the owner reads positive.`">
            <p v-if="owner.takeLines.length === 0" class="px-5 py-8 text-sm text-muted">Nothing went to the owner in this period.</p>
            <div v-else class="overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
              <table class="data-table w-full text-sm" data-testid="owner-take">
                <tbody>
                  <tr v-for="line in owner.takeLines" :key="line.category">
                    <th scope="row" class="w-full text-start font-normal">
                      <DrillLink :to="line.to" class="inline-flex min-w-0 items-center gap-2 text-toned">
                        <span class="size-2.5 shrink-0 rounded-[2px]" :style="{ background: line.colour }" aria-hidden="true" />
                        <span class="truncate">{{ line.name }}</span>
                      </DrillLink>
                    </th>
                    <td class="text-end">
                      <DrillLink :to="line.to" :label="`${line.name}, open the rows`"><MoneyText :cents="line.amount" precision="whole" /></DrillLink>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" class="text-start">Owner take</th>
                    <td class="text-end">
                      <DrillLink :to="owner.takeTotal.to" label="Owner take, open the rows"><MoneyText :cents="owner.takeTotal.amount" precision="whole" /></DrillLink>
                    </td>
                  </tr>
                </tfoot>
              </table>
              <template v-if="owner.reimbursements.length > 0">
                <h3 class="px-3 pt-4 text-xs font-medium text-muted">Reimbursements, outside owner pay</h3>
                <table class="data-table w-full text-sm" data-testid="owner-reimbursements">
                  <tbody>
                    <tr v-for="line in owner.reimbursements" :key="line.category">
                      <th scope="row" class="w-full text-start font-normal">
                        <DrillLink :to="line.to" class="text-toned"><span class="truncate">{{ line.name }}</span></DrillLink>
                      </th>
                      <td class="text-end">
                        <DrillLink :to="line.to" :label="`${line.name}, open the rows`"><MoneyText :cents="line.amount" precision="whole" /></DrillLink>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </div>
          </AppCard>
        </div>

        <DrillChartCard
          v-if="owner.hasLoanRoles"
          :chart="owner.timeline"
          title="Loans to the owner, by month"
          :subtitle="`${owner.period}. Lent below zero, repaid above it, and the balance since the ledger began.`"
          definition="The line is lent less repaid over every row since the ledger began, so it carries loans from before the period in view."
          :height="280"
          :phone-height="240"
        >
          <template #legend><ChartLegend :entries="owner.timelineLegend" /></template>
        </DrillChartCard>

        <div class="wide-pair">
          <AppCard
            v-if="owner.hasLoanRoles"
            title="Every loan, with the repayments that closed it"
            collapse-id="owner.loans"
            :summary="`${owner.loans.length} ${owner.loans.length === 1 ? 'loan' : 'loans'}, ${owner.openCount === 0 ? 'none open' : `${owner.openCount} open`}`"
            data-testid="owner-loans"
          >
            <template #subtitle>
              All time, private costs and private shares of company payments included. Repayments first close the loans they equal exactly. The rest go to the
              oldest open loan first, and one that outruns a loan carries on to the next.
              <template v-if="owner.openCount > 0">{{ owner.openCount }} open, the oldest from {{ owner.oldestOpen }}.</template>
              <template v-else>None open.</template>
            </template>
            <template #header>
              <dl class="grid grid-cols-3 gap-3">
                <div v-for="figure in owner.loanSummary" :key="figure.label" class="min-w-0">
                  <dt class="text-xs text-muted">{{ figure.label }}</dt>
                  <dd class="text-sm font-medium text-highlighted">
                    <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
                  </dd>
                </div>
              </dl>
            </template>
            <div class="px-4 pt-1 pb-2 sm:px-5">
              <LoanList :loans="owner.loans" />
            </div>
          </AppCard>

          <AppCard title="Costs the owner paid privately" collapse-id="owner.advances" :summary="owner.advancesSummary" data-testid="owner-advances">
            <template #subtitle>
              <span class="block max-w-[65ch]">
                All time, from the owner-advances tab. Each counts as a cost on its date, in its category. Reimbursements to the owner first repay the costs they
                equal exactly, and the rest repay the oldest first. They stay outside profit and loss.
              </span>
            </template>
            <template #actions>
              <UButton label="Add advance" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="open-add-advance" @click="addAdvance(null)" />
            </template>
            <template #header>
              <dl class="grid grid-cols-3 gap-3">
                <div v-for="figure in owner.advanceSummary" :key="figure.label" class="min-w-0">
                  <dt class="text-xs text-muted">{{ figure.label }}</dt>
                  <dd class="text-sm font-medium text-highlighted">
                    <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
                  </dd>
                </div>
              </dl>
            </template>
            <div class="px-4 pt-1 pb-2 sm:px-5">
              <section v-if="owner.unaccounted.length > 0" class="border-b border-default pt-2 pb-2" aria-labelledby="unaccounted-heading" data-testid="owner-unaccounted">
                <h3 id="unaccounted-heading" class="text-xs font-medium text-[var(--tone-warning)]">Reimbursed with no cost on file</h3>
                <p class="mt-0.5 max-w-[65ch] text-xs text-muted">
                  The company paid these to the owner on a reimbursement category, and no cost on the owner-advances tab accounts for them. Net owed counts them as paid to
                  the owner. Add the cost each one repaid and it nets out.
                </p>
                <UnaccountedReimbursements :payments="owner.unaccounted" :editable="!state.writing" @add-cost="addAdvance" />
              </section>
              <AdvanceList :advances="owner.advances" />
            </div>
          </AppCard>
        </div>
        <AddAdvanceDialog
          v-model:open="addingAdvance"
          :categories="ledger.workbook.categories"
          :default-date="owner.newestBooking"
          :in-sheet="state.workbook?.source === 'google'"
          :prefill="advancePrefill"
        />
      </template>
    </LedgerGate>
  </section>
</template>
