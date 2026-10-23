<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { monthLabel } from '../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { negateMoney } from '../../../shared/money/money'
import { formatMoney, formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../shared/ui/ShowAllButton.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import { chartedMonths } from '../../../features/filters/domain/periodPresets'
import DrillChartCard from '../../../features/filters/presentation/DrillChartCard.vue'
import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import { recordsOfKindIn } from '../../../features/workbook/domain/readWorkbook'
import type { RecordId } from '../../../features/workbook/domain/recordId'
import { NO_RECORDS, recordWithId } from '../../../features/workbook/domain/recordsRead'
import type { Transaction } from '../../../features/workbook/domain/workbook'
import { netOwed, ownerAdvances } from '../domain/ownerAdvances'
import { loanBenefitByYear } from '../domain/ownerLoanInterest'
import { loanMonths, ownerLoans } from '../domain/ownerLoans'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import { percentText } from '../domain/payroll/payrollArithmetic'
import { ruleValue } from '../ruleset/ruleset'
import AdvanceList from './AdvanceList.vue'
import type { AdvanceLine } from './AdvanceList.vue'
import LoanBenefitCard from './LoanBenefitCard.vue'
import LoanList from './LoanList.vue'
import type { LoanLine } from './LoanList.vue'
import { LENT_SERIES, OUTSTANDING_SERIES, REPAID_SERIES, loanTimelineChart } from './packCharts'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { OWNER_ADVANCE_RECORDS } from '../domain/hrDooKinds'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import AdvanceDialog from './AdvanceDialog.vue'

/**
 * Who owes whom between the owner and the company, over the whole ledger whatever the filters, since
 * a loan stays owed however long ago it was lent.
 */
const props = defineProps<{
  ledger: FilteredLedger
  /** The newest booking, which ends this year's benefit in kind. */
  asOf: CivilDate
}>()

const { drillLocation } = useFilters()
const names = useDisplayNames()
const showAllLoans = ref(false)
const showAllAdvances = ref(false)
const { state } = useWorkbook()

/** The advance the dialog changes, as the tab holds it. */
const editing = ref<OwnerAdvanceEntry | null>(null)
const editingOpen = ref(false)

function editAdvance(id: RecordId): void {
  editing.value = recordWithId(state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, OWNER_ADVANCE_RECORDS), id)?.record ?? null
  editingOpen.value = editing.value !== null
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function day(date: CivilDate): string {
  return dayFormat.format(new Date(date))
}

/** What a loan that is part of a split payment came out of, such as "Part of €60.00 to Paper & Ink on 2 Oct 2025: printer ink". */
function partOfPayment(whole: Transaction, note: string): string {
  const paid = `Part of ${formatMoney(negateMoney(whole.amount))} to ${whole.counterparty || 'a payee'} on ${day(whole.date)}`
  return note === '' ? paid : `${paid}: ${note}`
}

const owed = computed(() => {
  const { window } = props.ledger
  const workbook = hrDooWorkbook(props.ledger.workbook)
  const { categories, transactions } = workbook
  const tokens = chartTokens()
  const loans = ownerLoans(transactions, categories)
  const advances = ownerAdvances(workbook.ownerAdvances, transactions, categories)
  const balance = netOwed(loans, advances, categories)
  const benefits = loanBenefitByYear(workbook, props.asOf, ruleValue)
  const thisYear = benefits.find((benefit) => benefit.year === yearOf(props.asOf)) ?? null
  const months = loanMonths(transactions, categories, chartedMonths({ preset: 'all' }, window), window)
  const lastMonth = months[months.length - 1]
  const colours = { lent: tokens.buckets['owner-pay'], repaid: tokens.buckets.income }
  return {
    benefits,
    tiles: [
      {
        label: 'Net owed',
        value: formatWholeMoney(balance.amount),
        to: drillLocation(balance.drill),
        caption: balance.amount > 0 ? 'The owner owes the company' : balance.amount < 0 ? 'The company owes the owner' : 'Nothing owed either way',
        definition:
          `All time, one balance across both directions. The owner owes the company what was lent, private costs and the owner's parts of split company payments included, ` +
          `less what the owner paid back on a loan or reimbursement category (${formatWholeMoney(balance.loanBalance)}). ` +
          `The company owes the owner the costs the owner paid privately and has not been reimbursed for (${formatWholeMoney(balance.advancesOutstanding)}). ` +
          (advances.unaccountedTotal > 0
            ? `That figure counts the reimbursements with no cost on file (${formatMoney(advances.unaccountedTotal)}) as paid to the owner until their costs are added. `
            : '') +
          'Positive means the owner owes the company. A private cost the company paid in full counts as lent only when its row is in a category with the owner-loan-out role.',
      },
      ...(thisYear === null
        ? []
        : [
            {
              label: 'Benefit in kind',
              value: formatMoney(thisYear.figure.amount),
              to: { path: '/owner', hash: '#owner-loan-benefit' },
              caption:
                thisYear.carried >= thisYear.prescribed
                  ? `None at the ${percentText(thisYear.carried)} the loans carry`
                  : `${thisYear.year} so far, ${percentText(thisYear.prescribed)} less ${percentText(thisYear.carried)} charged`,
              definition:
                'What the loans to the owner are worth as pay in kind this year: the income tax law’s rate less the rate the loans carry, on each day’s balance. It is taxed through payroll.',
            },
          ]),
    ],
    hasLoanRoles: categoriesWithRole(categories, PACK_ROLES.ownerLoanOut).length > 0 && categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid).length > 0,
    unaccounted: advances.unaccounted.length,
    openCount: loans.openCount,
    oldestOpen: loans.oldestOpen === null ? null : day(loans.oldestOpen),
    timeline: loanTimelineChart(months, colours, tokens),
    timelineLegend: [
      { label: LENT_SERIES, colour: colours.lent },
      { label: REPAID_SERIES, colour: colours.repaid },
      { label: OUTSTANDING_SERIES, colour: 'var(--chart-ink)', mark: 'line' as const },
    ],
    timelineSummary: lastMonth === undefined ? 'No months to show' : `${formatWholeMoney(lastMonth.outstanding.amount)} owed at the end of ${monthLabel(lastMonth.month)}`,
    loanSummary: [
      { label: 'Lent', amount: loans.lent.amount, to: drillLocation(loans.lent.drill) },
      { label: 'Repaid', amount: loans.repaid.amount, to: drillLocation(loans.repaid.drill) },
      { label: 'Still owed', amount: loans.outstanding.amount, to: drillLocation(loans.outstanding.drill) },
    ],
    advanceSummary: [
      { label: 'Paid by the owner', amount: advances.advanced.amount, to: drillLocation(advances.advanced.drill) },
      { label: 'Reimbursed', amount: advances.reimbursed.amount, to: drillLocation(advances.reimbursed.drill) },
      { label: 'Owed to the owner', amount: advances.outstanding.amount, to: drillLocation(advances.outstanding.drill) },
    ],
    advancesSummary: `${advances.advances.length} ${advances.advances.length === 1 ? 'cost' : 'costs'}, ${formatWholeMoney(advances.outstanding.amount)} owed to the owner`,
    loansSummary: `${loans.loans.length} ${loans.loans.length === 1 ? 'loan' : 'loans'}, ${loans.openCount === 0 ? 'none open' : `${loans.openCount} open`}`,
    advances: [...advances.advances].reverse().map(
      (line): AdvanceLine => ({
        id: line.advance.id,
        paidOn: day(line.advance.date),
        description: line.advance.description,
        category: names.value.category(line.advance.category),
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
    loans: [...loans.loans].reverse().map(
      (loan, index): LoanLine => ({
        key: `${loan.lentOn}-${index}`,
        lentOn: day(loan.lentOn),
        part: loan.row.split === undefined ? null : partOfPayment(loan.row.split.whole, loan.row.split.note),
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

const shownLoans = computed(() => (showAllLoans.value ? owed.value.loans : owed.value.loans.slice(0, FIRST_SHOWN)))
const shownAdvances = computed(() => (showAllAdvances.value ? owed.value.advances : owed.value.advances.slice(0, FIRST_SHOWN)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="owner-owed-tiles">
      <KpiTile v-for="tile in owed.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <p v-if="owed.unaccounted > 0" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="owner-unaccounted">
      <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
      <span>
        {{ owed.unaccounted }} {{ owed.unaccounted === 1 ? 'reimbursement' : 'reimbursements' }} to the owner with no cost on file
        {{ owed.unaccounted === 1 ? 'waits' : 'wait' }} on Review. Net owed counts {{ owed.unaccounted === 1 ? 'it' : 'them' }} as paid to the owner until the cost is added.
        <DrillLink to="/review" in-prose class="font-medium text-highlighted">Open Review</DrillLink>
      </span>
    </p>

    <LoanBenefitCard v-if="owed.hasLoanRoles" :benefits="owed.benefits" :as-of="asOf" />

    <div class="wide-pair">
      <AppCard
        v-if="owed.hasLoanRoles"
        title="Every loan, with the repayments that closed it"
        collapse-id="owner.loans"
        :summary="owed.loansSummary"
        data-testid="owner-loans"
      >
        <template #subtitle>
          All time, private costs and the owner's parts of split company payments included. Repayments first close the loans they equal exactly. The rest go to the
          oldest open loan first, and one that outruns a loan carries on to the next.
          <template v-if="owed.openCount > 0">{{ owed.openCount }} open, the oldest from {{ owed.oldestOpen }}.</template>
          <template v-else>None open.</template>
        </template>
        <template #header>
          <dl class="grid grid-cols-3 gap-3">
            <div v-for="figure in owed.loanSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <LoanList :loans="shownLoans" />
        </div>
        <ShowAllButton v-if="owed.loans.length > FIRST_SHOWN" v-model:expanded="showAllLoans" :total="owed.loans.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>

      <AppCard title="Costs the owner paid privately" collapse-id="owner.advances" :summary="owed.advancesSummary" data-testid="owner-advances">
        <template #subtitle>
          <span class="block max-w-[65ch]">
            All time, from the owner-advances tab. Each counts as a cost on its date, in its category. Reimbursements to the owner first repay the costs they
            equal exactly, and the rest repay the oldest first. They stay outside profit and loss.
          </span>
        </template>
        <template #header>
          <dl class="grid grid-cols-3 gap-3">
            <div v-for="figure in owed.advanceSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <AdvanceList :advances="shownAdvances" :busy="state.writing" @edit="editAdvance" />
        </div>
        <ShowAllButton v-if="owed.advances.length > FIRST_SHOWN" v-model:expanded="showAllAdvances" :total="owed.advances.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>
    </div>

    <DrillChartCard
      v-if="owed.hasLoanRoles"
      :chart="owed.timeline"
      title="Loans to the owner, by month"
      subtitle="Lent below zero, repaid above it, and the balance since the ledger began."
      definition="The line is lent less repaid over every row since the ledger began."
      collapse-id="owner.loan-months"
      :summary="owed.timelineSummary"
      start-collapsed
      :height="280"
      :phone-height="240"
    >
      <template #legend><ChartLegend :entries="owed.timelineLegend" /></template>
    </DrillChartCard>
    <AdvanceDialog v-model:open="editingOpen" :categories="ledger.workbook.categories" :default-date="asOf" :editing="editing" />
  </div>
</template>
