<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { SortingState } from '@tanstack/vue-table'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { downloadFile } from '../../../../shared/files/downloadFile'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { sumMoney } from '../../../../shared/money/money'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { useFilters } from '../../filters/application/filterStore'
import { DEFAULT_BUCKET_LABELS } from '../../settings/domain/settings'
import { withoutChips } from '../../filters/domain/filterChips'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import ImportPanel from '../../imports/presentation/ImportPanel.vue'
import type { ShareTarget } from '../../owner-share/domain/ownerShare'
import OwnerShareDialog from '../../owner-share/presentation/OwnerShareDialog.vue'
import { counterpartyLabels } from '../../workbook/domain/counterpartyIdentity'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { categorise } from '../../../../shared/categorising/domain/categorise'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useCollapsedGroups } from '../application/collapsedGroups'
import { transactionsCsv } from '../application/transactionsCsv'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { categoryChangeOf, filedInOneCategory } from '../domain/categoryChange'
import { rowFiledAs, rowItemsOf } from '../../workbook/domain/splits'
import { ownerShareChangeOf } from '../domain/ownerShareChange'
import { advancesLeftOutByBankFilters, scopeTransactions } from '../domain/filterTransactions'
import { bookedRowOf, inBookingOrder, listedRows } from '../domain/listedRows'
import type { ListedBankRow, ListedRow } from '../domain/listedRows'
import { groupTransactions } from '../domain/transactionGroups'
import type { Grouping, TransactionGroup } from '../domain/transactionGroups'
import type { Transaction } from '../../workbook/domain/workbook'
import ChangeCategoryDialog from './ChangeCategoryDialog.vue'
import ReviewQueue from './ReviewQueue.vue'
import SplitDialog from './SplitDialog.vue'
import TransactionCards from './TransactionCards.vue'
import TransactionsTable from './TransactionsTable.vue'
import { REVIEW_TAB } from './transactionsLinks'
import { words } from './words'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

const ledger = useFilteredLedger()
const { filters, setFilters } = useFilters()
const { state } = useWorkbook()

/** The rows that wait for a person, whatever their period, since a row waits until someone settles it. Split rows count whole, since a person reviews the row the bank booked. */
const queue = computed(() => {
  const current = ledger.value
  if (current === null || state.workbook === null) return []
  const context = categorisationContextOf(current.workbook)
  return scopeTransactions(state.workbook.transactions, current.filters)
    .filter(needsReview)
    .map((transaction) => ({ transaction, verdict: categorise(transaction, current.workbook.rules, context) }))
})

const tabs = computed((): PageTab[] => [
  { label: words.tabs.rows, value: 'rows', icon: 'i-lucide-list' },
  { label: words.tabs.review, value: REVIEW_TAB, icon: 'i-lucide-inbox', count: queue.value.length },
  { label: words.tabs.import, value: 'import', icon: 'i-lucide-file-up' },
])

const GROUPINGS: readonly { readonly label: string; readonly value: Grouping }[] = [
  { label: words.groupings.none, value: 'none' },
  { label: words.groupings.month, value: 'month' },
  { label: words.groupings.category, value: 'category' },
  { label: words.groupings.counterparty, value: 'counterparty' },
]

const groupBy = ref<Grouping>('none')
const sorting = ref<SortingState>([{ id: 'date', desc: true }])
const collapsed = useCollapsedGroups(() => groupBy.value)

// The search box writes to the shared filters after a pause, so the URL is not rewritten per key.
const search = ref(filters.value.text)
let pendingSearch: ReturnType<typeof setTimeout> | undefined
watch(search, (text) => {
  clearTimeout(pendingSearch)
  pendingSearch = setTimeout(() => {
    if (text !== filters.value.text) {
      void setFilters({ ...filters.value, text })
    }
  }, 250)
})
watch(
  () => filters.value.text,
  (text) => {
    search.value = text
  },
)
onBeforeUnmount(() => clearTimeout(pendingSearch))

const rows = computed<ListedRow[]>(() => listedRows(ledger.value?.selected ?? [], ledger.value?.selectedAdvances ?? []))
const labels = computed(() => counterpartyLabels(ledger.value?.workbook.transactions ?? []))
const total = computed(() => sumMoney(rows.value.map((row) => row.amount)))
const severalAccounts = computed(() => new Set(rows.value.flatMap((row) => (row.kind === 'bank' ? [row.account] : []))).size > 1)

/** Advances in the period that only the account, counterparty or review filter keeps off the list, said in words. */
const advancesLeftOut = computed(() => {
  const shown = ledger.value
  const count = shown === null ? 0 : advancesLeftOutByBankFilters(shown.booked.ownerAdvances, shown.filters, shown.window)
  if (shown === null || count === 0) {
    return null
  }
  const { accounts, counterparties, needsReview } = shown.filters
  const filters = ([accounts.length > 0 ? 'account' : null, counterparties.length > 0 ? 'counterparty' : null, needsReview ? 'review' : null] as const).filter((name) => name !== null)
  return words.advancesLeftOut(count, filters)
})

const phone = usePhoneLayout()

/** The table sorts manually, so groups keep their own order and the cards follow the same sort. */
const sortedRows = computed<ListedRow[]>(() => {
  const [rule] = sorting.value
  const direction = rule?.desc === false ? 1 : -1
  return [...rows.value].sort((left, right) => direction * (rule?.id === 'amount' ? left.amount - right.amount : inBookingOrder(left, right)))
})

const groups = computed<TransactionGroup[] | null>(() => {
  const shown = ledger.value
  return groupBy.value === 'none' || shown === null ? null : groupTransactions(sortedRows.value, groupBy.value, { window: shown.window, counterpartyLabels: labels.value })
})

const bucketLabels = computed(() => ledger.value?.workbook.settings.bucketLabels ?? DEFAULT_BUCKET_LABELS)

/** The payment the split editor is open on. */
const splitting = ref<Transaction | null>(null)
const splitOpen = ref(false)

function openSplit(row: Transaction): void {
  splitting.value = row
  splitOpen.value = true
}

/** The settled row whose category is being changed. */
const changing = ref<Transaction | null>(null)
const changeOpen = ref(false)

/**
 * A part of a split row opens the split editor on the row as booked, since its category lives on the
 * splits tab, unless every part is in one category, which Change category then changes for all of them.
 * A part of a shared row changes the row it comes from.
 */
function changeCategory(row: ListedBankRow): void {
  const change = categoryChangeOf(row)
  if (change === 'split') {
    const workbook = state.workbook
    const whole = workbook?.transactions.find((transaction) => transaction.id === row.id)
    if (whole === undefined || workbook === undefined || workbook === null) return
    const parts = rowItemsOf(workbook.splits)(whole)
    if (filedInOneCategory(parts)) {
      changing.value = rowFiledAs(whole, parts)
      changeOpen.value = true
    } else openSplit(whole)
  } else if (change === 'ledger') {
    changing.value = row.ownerPart?.whole ?? row
    changeOpen.value = true
  }
}

/** The row as booked whose owner share is being set, with the record that holds it. */
const sharing = ref<{ readonly target: ShareTarget; readonly row: ListedRow } | null>(null)
const shareOpen = ref(false)

/** Owner shares show only while the owner-pay module is on. */
function shareTargetOf(row: ListedRow): ShareTarget | null {
  return ledger.value?.workbook.settings.ownerPayModule === true ? ownerShareChangeOf(row) : null
}

function setOwnerShare(row: ListedRow): void {
  const target = shareTargetOf(row)
  if (target === null) return
  sharing.value = { target, row: bookedRowOf(row) }
  shareOpen.value = true
}

function exportCsv(): void {
  downloadFile(transactionsCsv(rows.value), `kuna-transactions-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <ItemsMoveNotice />
    <PageTabs :tabs="tabs" :label="words.tabs.label">
      <template #rows>
        <div class="flex flex-col gap-6">
          <LedgerGate>
            <template v-if="ledger">
              <FilterBar :workbook="ledger.workbook" :window="ledger.window" />

              <div class="flex flex-wrap items-center gap-2">
                <UInput v-model="search" icon="i-lucide-search" :placeholder="phone ? words.searchShort : words.search" :aria-label="words.searchLabel" size="sm" class="w-full @2xl:w-96" />
                <USelect v-model="groupBy" :items="[...GROUPINGS]" size="sm" :aria-label="words.groupLabel" class="w-44" />
                <template v-if="groups">
                  <UButton
                    icon="i-lucide-chevrons-down-up"
                    v-bind="phone ? {} : { label: words.collapseAll }"
                    :aria-label="words.collapseAll"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    data-testid="collapse-all"
                    @click="collapsed.collapseAll(groups.map((group) => group.key))"
                  />
                  <UButton
                    icon="i-lucide-chevrons-up-down"
                    v-bind="phone ? {} : { label: words.expandAll }"
                    :aria-label="words.expandAll"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    data-testid="expand-all"
                    @click="collapsed.expandAll()"
                  />
                </template>
                <UButton icon="i-lucide-download" :label="words.exportCsv" color="neutral" variant="outline" size="sm" class="sm:ms-auto" :disabled="rows.length === 0" @click="exportCsv" />
              </div>

              <NoteLine v-if="advancesLeftOut" data-testid="advances-left-out">{{ advancesLeftOut }}</NoteLine>

              <EmptyState
                v-if="rows.length === 0"
                icon="i-lucide-search-x"
                :title="words.noMatchTitle"
                :description="words.noMatchDescription"
                :actions="[{ label: words.clearFilters, color: 'neutral', variant: 'outline', onClick: () => setFilters(withoutChips(filters)) }]"
              />
              <TransactionCards
                v-else-if="phone"
                :rows="sortedRows"
                :groups="groups"
                :total="total"
                :bucket-labels="bucketLabels"
                :is-collapsed="collapsed.isCollapsed"
                :show-account="severalAccounts"
                :share-target-of="shareTargetOf"
                @toggle="collapsed.toggle"
                @split="openSplit"
                @change-category="changeCategory"
                @owner-share="setOwnerShare"
              />
              <TransactionsTable
                v-else
                v-model:sorting="sorting"
                :rows="sortedRows"
                :groups="groups"
                :total="total"
                :bucket-labels="bucketLabels"
                :is-collapsed="collapsed.isCollapsed"
                :share-target-of="shareTargetOf"
                @toggle="collapsed.toggle"
                @split="openSplit"
                @change-category="changeCategory"
                @owner-share="setOwnerShare"
              />
              <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting" :categories="ledger.workbook.categories" />
              <ChangeCategoryDialog v-if="changing" v-model:open="changeOpen" :row="changing" />
              <OwnerShareDialog
                v-if="sharing"
                v-model:open="shareOpen"
                :target="sharing.target"
                :row="{ ...sharing.row, ownerShare: sharing.row.kind === 'bank' ? sharing.row.ownerShare : sharing.row.advance.ownerShare }"
              />
            </template>
          </LedgerGate>
        </div>
      </template>
      <template #[REVIEW_TAB]>
        <ReviewQueue :queue="queue" />
      </template>
      <template #import>
        <ImportPanel />
      </template>
    </PageTabs>
  </section>
</template>
