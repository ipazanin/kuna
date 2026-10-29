<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../../shared/charts/chartTokens'
import { negateMoney } from '../../../../../shared/money/money'
import { formatMoney, formatWholeMoney } from '../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../../shared/ui/ShowAllButton.vue'
import { useFilters } from '../../../filters/application/filterStore'
import { filterChips } from '../../../filters/domain/filterChips'
import { periodRange } from '../../../filters/domain/filterState'
import { periodInWords } from '../../../filters/domain/periodInWords'
import { chartedMonths } from '../../../filters/domain/periodPresets'
import DrillChartCard from '../../../filters/presentation/DrillChartCard.vue'
import type { FilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../../workbook/application/workbookStore'
import { recordsOfKindIn } from '../../../workbook/domain/readWorkbook'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { NO_RECORDS, recordWithId } from '../../../../../shared/storage/domain/recordsRead'
import type { Transaction } from '../../../workbook/domain/workbook'
import { owedInPeriod } from '../domain/owedInPeriod'
import type { PeriodBalance } from '../domain/owedInPeriod'
import { ownerAdvances } from '../domain/ownerAdvances'
import { loanMonths } from '../domain/ownerLoans'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import AdvanceList from './AdvanceList.vue'
import type { AdvanceLine } from './AdvanceList.vue'
import LoanList from './LoanList.vue'
import type { LoanLine } from './LoanList.vue'
import { LENT_SERIES, REPAID_SERIES, loanTimelineChart } from './packCharts'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { OWNER_ADVANCE_RECORDS } from '../domain/hrDooKinds'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import AdvanceDialog from './AdvanceDialog.vue'

/**
 * Who owes whom between the owner and the company over the period in view: the balances as the books
 * stood on its last day, and what was lent, repaid, paid and reimbursed in it. The other filters do
 * not apply, since a balance of one account or category is no debt anyone owes.
 */
const props = defineProps<{
  ledger: FilteredLedger
  /** The newest booking, the day a new advance defaults to. */
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

/** What a loan that is part of a split payment came out of, such as "Part of €60.00 to Paper & Ink on 2 Oct 2025: printer ink". */
function partOfPayment(whole: Transaction, note: string): string {
  const paid = `Part of ${formatMoney(negateMoney(whole.amount))} to ${whole.counterparty || 'a payee'} on ${dayLabel(whole.date)}`
  return note === '' ? paid : `${paid}: ${note}`
}

const owed = computed(() => {
  const { window, filters } = props.ledger
  const workbook = hrDooWorkbook(props.ledger.booked)
  const { categories, transactions } = workbook
  const tokens = chartTokens()
  const period = periodInWords(filters.period, window)
  const inPeriod = owedInPeriod(workbook, filters.period, window, props.asOf)
  const balance = inPeriod.net
  const on = dayLabel(inPeriod.on)
  const unaccounted = ownerAdvances(workbook.ownerAdvances, transactions, categories).unaccounted
  const months = loanMonths(transactions, categories, chartedMonths(filters.period, window), window)
  const lentInMonths = months.reduce((sum, month) => sum + month.lent.amount, 0)
  const repaidInMonths = months.reduce((sum, month) => sum + month.repaid.amount, 0)
  const colours = { lent: tokens.buckets['owner-pay'], repaid: tokens.buckets.income }
  const figuresOf = (balances: PeriodBalance, labels: readonly [string, string, string, string]) =>
    [balances.start, balances.added, balances.settled, balances.end].map((figure, index) => ({
      label: labels[index]!,
      amount: figure.amount,
      to: figure.drill === null ? null : drillLocation(figure.drill),
    }))
  return {
    period,
    on,
    inView: { range: periodRange(filters.period, window), words: period },
    tiles: [
      {
        label: 'Net owed',
        value: formatWholeMoney(balance.amount),
        to: drillLocation(balance.drill),
        caption: `${balance.amount > 0 ? 'The owner owes the company' : balance.amount < 0 ? 'The company owes the owner' : 'Nothing owed either way'} on ${on}`,
        definition:
          `One balance across both directions, as the books stood on ${on}, the last day of the period or the newest booking. The owner owes the company what was lent, private costs and the owner's parts of split company payments included, ` +
          `less what the owner paid back on a loan or reimbursement category (${formatWholeMoney(balance.loanBalance)}). ` +
          `The company owes the owner the costs the owner paid privately and has not been reimbursed for (${formatWholeMoney(balance.advancesOutstanding)}). ` +
          (inPeriod.unaccountedTotal > 0
            ? `That figure counts the reimbursements with no cost on file (${formatMoney(inPeriod.unaccountedTotal)}) as paid to the owner until their costs are added. `
            : '') +
          'Positive means the owner owes the company. A private cost the company paid in full counts as lent only when its row is in a category with the owner-loan-out role.',
      },
    ],
    hasLoanRoles: categoriesWithRole(categories, PACK_ROLES.ownerLoanOut).length > 0 && categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid).length > 0,
    otherFilters: filters.accounts.length > 0 || filterChips(filters, { counterparty: String, bucket: String, category: String }).length > 0,
    unaccounted: unaccounted.length,
    openCount: inPeriod.openLoans,
    oldestOpen: inPeriod.oldestOpenLoan === null ? null : dayLabel(inPeriod.oldestOpenLoan),
    timeline: loanTimelineChart(months, colours, tokens),
    timelineLegend: [
      { label: LENT_SERIES, colour: colours.lent },
      { label: REPAID_SERIES, colour: colours.repaid },
    ],
    timelineSummary: months.length === 0 ? 'No months to show' : `${formatWholeMoney(lentInMonths)} lent, ${formatWholeMoney(repaidInMonths)} repaid`,
    loanSummary: figuresOf(inPeriod.loans, ['Owed at the start', 'Lent', 'Repaid', 'Owed at the end']),
    advanceSummary: figuresOf(inPeriod.advances, ['Owed at the start', 'Paid by the owner', 'Reimbursed', 'Owed at the end']),
    advancesSummary: `${inPeriod.advanceList.length} ${inPeriod.advanceList.length === 1 ? 'cost' : 'costs'}, ${formatWholeMoney(inPeriod.advances.end.amount)} owed to the owner on ${on}`,
    loansSummary: `${inPeriod.loanList.length} ${inPeriod.loanList.length === 1 ? 'loan' : 'loans'}, ${inPeriod.openLoans === 0 ? 'none open' : `${inPeriod.openLoans} open`} on ${on}`,
    advances: [...inPeriod.advanceList].reverse().map(
      (line): AdvanceLine => ({
        id: line.advance.id,
        paidOn: dayLabel(line.advance.date),
        description: line.advance.description,
        category: names.value.category(line.advance.category),
        amount: line.advance.amount,
        to: drillLocation(line.drill),
        remaining: line.remaining,
        open: line.status === 'open',
        repaidOn: line.repaidOn === null ? null : dayLabel(line.repaidOn),
        repayments: line.repayments.map((share, shareIndex) => ({
          key: `${share.repaidOn}-${shareIndex}`,
          date: dayLabel(share.repaidOn),
          applied: share.applied,
          to: drillLocation(share.drill),
        })),
      }),
    ),
    loans: [...inPeriod.loanList].reverse().map(
      (loan, index): LoanLine => ({
        key: `${loan.lentOn}-${index}`,
        lentOn: dayLabel(loan.lentOn),
        part: loan.row.split === undefined ? null : partOfPayment(loan.row.split.whole, loan.row.split.note),
        amount: loan.amount,
        remaining: loan.remaining,
        open: loan.status === 'open',
        repaidOn: loan.repaidOn === null ? null : dayLabel(loan.repaidOn),
        to: drillLocation(loan.drill),
        repayments: loan.repayments.map((share, shareIndex) => ({
          key: `${share.repaidOn}-${shareIndex}`,
          date: dayLabel(share.repaidOn),
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
    <p v-if="owed.otherFilters" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="owner-owed-filters">
      <UIcon name="i-lucide-funnel-x" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <span>Who owes whom follows the period only. The accounts and the other filters apply on Taken.</span>
    </p>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="owner-owed-tiles">
      <KpiTile v-for="tile in owed.tiles" :key="tile.label" v-bind="tile" />
    </div>

    <p v-if="owed.unaccounted > 0" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="owner-unaccounted">
      <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
      <span>
        Whatever the period, {{ owed.unaccounted }} {{ owed.unaccounted === 1 ? 'reimbursement' : 'reimbursements' }} to the owner with no cost on file
        {{ owed.unaccounted === 1 ? 'waits' : 'wait' }} on Review. Net owed counts {{ owed.unaccounted === 1 ? 'it' : 'them' }} as paid to the owner until the cost is added.
        <DrillLink to="/company/review" in-prose class="font-medium text-highlighted">Open Review</DrillLink>
      </span>
    </p>

    <div class="wide-pair">
      <AppCard
        v-if="owed.hasLoanRoles"
        title="Every loan, with the repayments that closed it"
        collapse-id="owner.loans"
        :summary="owed.loansSummary"
        data-testid="owner-loans"
      >
        <template #subtitle>
          {{ owed.period }}. Each loan with a balance in the period, as it stood on {{ owed.on }}, private costs and the owner's parts of split company payments
          included. Repayments first close the loans they equal exactly. The rest go to the oldest open loan first, and one that outruns a loan carries on to the next.
          <template v-if="owed.openCount > 0">{{ owed.openCount }} open, the oldest from {{ owed.oldestOpen }}.</template>
          <template v-else>None open.</template>
        </template>
        <template #header>
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="owner-loans-figures">
            <div v-for="figure in owed.loanSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <LoanList :loans="shownLoans" :empty="`No loan to the owner had a balance in ${owed.period}.`" />
        </div>
        <ShowAllButton v-if="owed.loans.length > FIRST_SHOWN" v-model:expanded="showAllLoans" :total="owed.loans.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>

      <AppCard title="Costs the owner paid privately" collapse-id="owner.advances" :summary="owed.advancesSummary" data-testid="owner-advances">
        <template #subtitle>
          <span class="block max-w-[65ch]">
            {{ owed.period }}, from the owner-advances tab. Each cost owed in the period, as it stood on {{ owed.on }}. Each counts as a cost on its date, in its
            category. Reimbursements to the owner first repay the costs they equal exactly, and the rest repay the oldest first. They stay outside profit and loss.
          </span>
        </template>
        <template #header>
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="owner-advances-figures">
            <div v-for="figure in owed.advanceSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="`${figure.label}, open the rows`"><MoneyText :cents="figure.amount" precision="whole" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <AdvanceList :advances="shownAdvances" :busy="state.writing" :empty="`No cost the owner paid privately was owed in ${owed.period}.`" @edit="editAdvance" />
        </div>
        <ShowAllButton v-if="owed.advances.length > FIRST_SHOWN" v-model:expanded="showAllAdvances" :total="owed.advances.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>
    </div>

    <DrillChartCard
      v-if="owed.hasLoanRoles"
      :chart="owed.timeline"
      title="Loans to the owner, by month"
      :subtitle="`${owed.period}. Lent below zero and repaid above it.`"
      definition="What was lent to the owner and repaid each month. The balance at each month's end is beside the ring on Taken."
      collapse-id="owner.loan-months"
      :summary="owed.timelineSummary"
      start-collapsed
      :height="280"
      :phone-height="240"
    >
      <template #legend><ChartLegend :entries="owed.timelineLegend" /></template>
    </DrillChartCard>
    <AdvanceDialog v-model:open="editingOpen" :categories="ledger.workbook.categories" :default-date="asOf" :editing="editing" :in-view="owed.inView" />
  </div>
</template>
