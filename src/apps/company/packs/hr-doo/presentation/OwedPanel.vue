<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../../shared/charts/chartTokens'
import { negateMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../../shared/ui/ShowAllButton.vue'
import { useFilters } from '../../../filters/application/filterStore'
import { filterChips } from '../../../filters/domain/filterChips'
import { periodRange } from '../../../filters/domain/filterState'
import { periodInWords } from '../../../filters/domain/periodInWords'
import { periodMonths } from '../../../filters/domain/periodPresets'
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
import { plural } from '../../../../../shared/text/translation'
import { words } from './words'

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
  const paid = words.owed.partOf(formatMoney(negateMoney(whole.amount)), whole.counterparty, dayLabel(whole.date))
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
  const months = loanMonths(transactions, categories, periodMonths(filters.period, window), window)
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
        label: words.owed.netOwed,
        value: formatMoney(balance.amount),
        to: drillLocation(balance.drill),
        caption: words.owed.direction(balance.amount, on),
        definition: words.owed.definition(
          on,
          formatMoney(balance.loanBalance),
          formatMoney(balance.advancesOutstanding),
          inPeriod.unaccountedTotal > 0 ? formatMoney(inPeriod.unaccountedTotal) : null,
        ),
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
    timelineSummary: months.length === 0 ? words.owed.noMonths : words.owed.lentAndRepaid(formatMoney(lentInMonths), formatMoney(repaidInMonths)),
    loanSummary: figuresOf(inPeriod.loans, words.owed.loanFigures),
    advanceSummary: figuresOf(inPeriod.advances, words.owed.advanceFigures),
    advancesSummary: plural(words.owed.advancesSummary(inPeriod.advanceList.length, formatMoney(inPeriod.advances.end.amount), on), inPeriod.advanceList.length),
    loansSummary: plural(words.owed.loansSummary(inPeriod.loanList.length, inPeriod.openLoans, on), inPeriod.loanList.length),
    advances: [...inPeriod.advanceList].reverse().map((line): AdvanceLine => ({
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
    })),
    loans: [...inPeriod.loanList].reverse().map((loan, index): LoanLine => ({
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
    })),
  }
})

const shownLoans = computed(() => (showAllLoans.value ? owed.value.loans : owed.value.loans.slice(0, FIRST_SHOWN)))
const shownAdvances = computed(() => (showAllAdvances.value ? owed.value.advances : owed.value.advances.slice(0, FIRST_SHOWN)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <p v-if="owed.otherFilters" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="owner-owed-filters">
      <UIcon name="i-lucide-funnel-x" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <span>{{ words.owed.otherFilters }}</span>
    </p>

    <DashboardGrid layout="tiles" data-testid="owner-owed-tiles">
      <KpiTile v-for="tile in owed.tiles" :key="tile.label" v-bind="tile" />
    </DashboardGrid>

    <p v-if="owed.unaccounted > 0" class="flex items-start gap-2 text-sm leading-5 text-toned" data-testid="owner-unaccounted">
      <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <span>
        {{ plural(words.owed.unaccounted(owed.unaccounted), owed.unaccounted) }}
        <DrillLink to="/company/review" in-prose class="font-medium text-highlighted">{{ words.owed.openReview }}</DrillLink>
      </span>
    </p>

    <DashboardGrid layout="pair">
      <AppCard v-if="owed.hasLoanRoles" :title="words.owed.loans.title" collapse-id="owner.loans" :summary="owed.loansSummary" data-testid="owner-loans">
        <template #subtitle>
          {{ words.owed.loans.subtitle(owed.period, owed.on) }}
          <template v-if="owed.openCount > 0 && owed.oldestOpen">{{ words.owed.loans.open(owed.openCount, owed.oldestOpen) }}</template>
          <template v-else>{{ words.owed.loans.noneOpen }}</template>
        </template>
        <template #header>
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="owner-loans-figures">
            <div v-for="figure in owed.loanSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="words.figure.openRows(figure.label)"><MoneyText :cents="figure.amount" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <LoanList :loans="shownLoans" :empty="words.owed.loans.empty(owed.period)" />
        </div>
        <ShowAllButton v-if="owed.loans.length > FIRST_SHOWN" v-model:expanded="showAllLoans" :total="owed.loans.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>

      <AppCard :title="words.owed.advances.title" collapse-id="owner.advances" :summary="owed.advancesSummary" data-testid="owner-advances">
        <template #subtitle>
          <span class="block max-w-[65ch]">
            {{ words.owed.advances.subtitle(owed.period, owed.on) }}
          </span>
        </template>
        <template #header>
          <dl class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="owner-advances-figures">
            <div v-for="figure in owed.advanceSummary" :key="figure.label" class="min-w-0">
              <dt class="text-xs text-muted">{{ figure.label }}</dt>
              <dd class="text-sm font-medium text-highlighted">
                <DrillLink :to="figure.to" :label="words.figure.openRows(figure.label)"><MoneyText :cents="figure.amount" /></DrillLink>
              </dd>
            </div>
          </dl>
        </template>
        <div class="px-4 pt-1 pb-2 sm:px-5">
          <AdvanceList :advances="shownAdvances" :busy="state.writing" :empty="words.owed.advances.empty(owed.period)" @edit="editAdvance" />
        </div>
        <ShowAllButton v-if="owed.advances.length > FIRST_SHOWN" v-model:expanded="showAllAdvances" :total="owed.advances.length" class="px-4 pb-4 sm:px-5" />
      </AppCard>
    </DashboardGrid>

    <DrillChartCard
      v-if="owed.hasLoanRoles"
      :chart="owed.timeline"
      :title="words.owed.timeline.title"
      :subtitle="words.owed.timeline.subtitle(owed.period)"
      :definition="words.owed.timeline.definition"
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
