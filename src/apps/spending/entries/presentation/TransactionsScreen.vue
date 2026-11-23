<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import EntryDialog from './EntryDialog.vue'
import EntryFilters from './EntryFilters.vue'
import EntryList from './EntryList.vue'
import FilterTotals from './FilterTotals.vue'
import { useEntryFilters } from './useEntryFilters'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { SPENDING_ACCOUNTS_ROUTE, SPENDING_REVIEW_TAB } from '../../overview/presentation/spendingLinks'
import EventPicker from './EventPicker.vue'
import LabelPicker from './LabelPicker.vue'
import SelectionBar from '../../../../shared/ui/SelectionBar.vue'
import QuickAddCard from '../../shortcuts/presentation/QuickAddCard.vue'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { takesNewRowsByHand } from '../../workbook/domain/account'
import { entriesAndSharedCosts } from '../../sharedCosts/domain/sharedCostEntries'
import SharedCostDialog from '../../sharedCosts/presentation/SharedCostDialog.vue'
import { sharedCostHomes } from '../../sharedCosts/presentation/sharedCostNames'
import { words as sharedCostWords } from '../../sharedCosts/presentation/words'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as screenWords } from '../../screenWords'
import ReceiptDialog from '../../receipts/presentation/ReceiptDialog.vue'
import ReceiptPhotoPicker from '../../receipts/presentation/ReceiptPhotoPicker.vue'
import { useReceiptRows } from '../../receipts/presentation/useReceiptRows'
import { receiptAccounts } from '../../receipts/domain/receiptMatch'
import { words as receiptWords } from '../../receipts/presentation/words'
import { toReviewCount } from '../../links/application/linkReview'
import ImportPanel from '../../statements/presentation/ImportPanel.vue'
import ReviewPanel from '../../statements/presentation/ReviewPanel.vue'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import MenuButton from '../../../../shared/ui/MenuButton.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The entries of a month or of every month by day, newest first, found by account, category, label, event and payee, each opening the entry dialog and, while a key is kept, taking a receipt photo to the chat, with each shared cost and its entries under it, or picked to be labelled, put in an event or made a shared cost while rows are being selected, with the rows to review and the statement import on tabs of their own. */
const { state } = useSpendingBooks()
const rates = useRates()
const filters = useEntryFilters(() => state.workbook)

const accounts = computed(() => state.workbook?.accounts ?? [])
const categories = computed(() => state.workbook?.categories ?? [])
const transactions = computed(() => state.workbook?.transactions ?? [])
const labels = computed(() => state.workbook?.labels ?? [])

/** The entries and shared costs the filters leave, newest first, a shared cost with its entries under it. */
const rows = computed(() => {
  const book = state.workbook
  if (book === null) return []
  const { shows, showsSharedCost } = filters
  return entriesAndSharedCosts(book, everydayRates(rates.value)).filter((line) => (line.kind === 'entry' ? shows(line.row) : showsSharedCost(line.entry)))
})
const homes = computed(() => sharedCostHomes(state.workbook))

/** The entries picked to be labelled or put in an event, or null while a tap opens an entry. A file from before items keeps neither, so it offers its move instead. */
const picked = ref<ReadonlySet<RecordId> | null>(null)
const canLabel = computed(() => state.workbook !== null && !isBeforeItems(state.workbook.stored))
const pickedRows = computed(() => (picked.value === null ? [] : transactions.value.filter((row) => picked.value!.has(row.id))))
const pickerOpen = ref(false)
/** The shared cost its dialog changes, or null while it makes one from the picked entries. */
const sharedCostOpen = ref(false)
const openedSharedCost = ref<SharedCost | null>(null)
const phone = usePhoneLayout()

function openSharedCost(sharedCost: SharedCost | null): void {
  openedSharedCost.value = sharedCost
  sharedCostOpen.value = true
}
const eventPickerOpen = ref(false)
const hasEvents = computed(() => (state.workbook?.events.length ?? 0) > 0)

/** A list over more than one month shows its newest entries first and the rest behind Show all, since a year of entries makes a long list. */
const allShown = ref(false)
const listed = computed(() => (!filters.manyMonths || allShown.value ? rows.value : rows.value.slice(0, FIRST_SHOWN)))

/** A new filter starts the list short again and drops the picks, so no entry out of sight stays picked. */
watch(
  [() => filters.month, () => filters.span?.from, () => filters.span?.to, () => filters.account, () => filters.category, () => filters.label, () => filters.event, () => filters.pickedPayee?.key],
  () => {
    allShown.value = false
    if (picked.value !== null) picked.value = new Set()
  },
)

function pick(entry: Transaction): void {
  const current = new Set(picked.value ?? [])
  if (current.has(entry.id)) current.delete(entry.id)
  else current.add(entry.id)
  picked.value = current
}

const tabs = computed(() => [
  { value: 'entries', label: screenWords.entries, icon: 'i-lucide-list' },
  { value: SPENDING_REVIEW_TAB, label: statementWords.tabs.review, icon: 'i-lucide-inbox', count: state.workbook === null ? 0 : toReviewCount(state.workbook, today()) },
  { value: 'import', label: statementWords.tabs.import, icon: 'i-lucide-file-up' },
])

const canAdd = computed(() => accounts.value.some((account) => takesNewRowsByHand(account, today())))
/** Whether the open accounts are all ones the bank fills, so no entry can be typed until one kept by hand is added. */
const allFromBank = computed(() => !canAdd.value && accounts.value.some((candidate) => !candidate.closed))
const canAddReceipt = computed(() => receiptAccounts(accounts.value).length > 0)

const receiptOpen = ref(false)
const dialogOpen = ref(false)
const editing = ref<Transaction | null>(null)

const receiptPicker = useTemplateRef('receiptPicker')
const takesReceipt = useReceiptRows()

const receiptChoices = [
  { value: 'type', label: words.receipt.typeIn, icon: 'i-lucide-keyboard' },
  { value: 'chat', label: words.receipt.readInChat, icon: 'i-lucide-camera' },
] as const

function addReceipt(way: (typeof receiptChoices)[number]['value']): void {
  if (way === 'type') receiptOpen.value = true
  else receiptPicker.value?.take(null)
}

function openEntry(entry: Transaction | null): void {
  editing.value = entry
  dialogOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.entries" :description="allFromBank ? words.allFromBank : ''">
      <template v-if="allFromBank && transactions.length > 0" #actions>
        <UButton :label="accountWords.add" icon="i-lucide-landmark" color="neutral" variant="outline" :to="SPENDING_ACCOUNTS_ROUTE" data-testid="spending-header-go-to-accounts" />
      </template>
      <template v-else-if="canAdd" #actions>
        <template v-if="canAddReceipt && assistKeyKept">
          <MenuButton :label="receiptWords.add" icon="i-lucide-receipt" :choices="receiptChoices" data-testid="spending-add-receipt" @pick="addReceipt" />
        </template>
        <UButton v-else-if="canAddReceipt" :label="receiptWords.add" icon="i-lucide-receipt" color="neutral" variant="outline" data-testid="spending-add-receipt" @click="receiptOpen = true" />
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-add-entry" @click="openEntry(null)" />
      </template>
    </PageHeader>
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="state.workbook === null && state.status !== 'error'" :heading="false" :cards="1" />
    <PageTabs v-else-if="state.workbook !== null" :tabs="tabs" :label="statementWords.tabs.label">
      <template #entries>
        <!-- PageTabs gives the measure only to a lone card, so this stack of cards repeats it. -->
        <div class="flex max-w-2xl flex-col gap-6">
          <QuickAddCard v-if="picked === null" />
          <EmptyState
            v-if="transactions.length === 0"
            icon="i-lucide-list"
            :title="words.noEntries"
            :description="canAdd ? words.noEntriesDescription : allFromBank ? words.allFromBank : words.needsAccount"
            data-testid="spending-transactions-empty"
          >
            <template #actions>
              <UButton v-if="canAdd" :label="words.add" icon="i-lucide-plus" data-testid="spending-add-entry" @click="openEntry(null)" />
              <UButton v-else :label="accountWords.add" icon="i-lucide-landmark" :to="SPENDING_ACCOUNTS_ROUTE" data-testid="spending-go-to-accounts" />
            </template>
          </EmptyState>
          <SelectionBar v-if="picked !== null && transactions.length > 0" :count="picked.size" @cancel="picked = null">
            <UButton
              v-if="hasEvents"
              :label="words.inEvent.action"
              icon="i-lucide-calendar-range"
              color="neutral"
              variant="outline"
              :disabled="picked.size === 0"
              data-testid="spending-selection-event"
              @click="eventPickerOpen = true"
            />
            <UButton
              v-bind="phone ? {} : { label: sharedCostWords.make }"
              :aria-label="sharedCostWords.make"
              icon="i-lucide-users"
              color="neutral"
              variant="outline"
              :disabled="picked.size === 0"
              data-testid="spending-selection-shared-cost"
              @click="openSharedCost(null)"
            />
            <UButton :label="words.labelling.label" icon="i-lucide-tag" :disabled="picked.size === 0" data-testid="spending-selection-label" @click="pickerOpen = true" />
          </SelectionBar>
          <AppCard v-if="transactions.length > 0" data-testid="spending-transactions">
            <EntryFilters :filters="filters">
              <UButton
                v-if="canLabel && picked === null && rows.length > 0"
                v-bind="phone ? {} : { label: words.labelling.select }"
                :aria-label="words.labelling.selectHelp"
                icon="i-lucide-list-checks"
                size="sm"
                color="neutral"
                variant="outline"
                class="sm:ms-auto"
                data-testid="spending-select"
                @click="picked = new Set()"
              />
            </EntryFilters>
            <FilterTotals :filters="filters" />
            <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="spending-transactions-none">{{ words.noMatch }}</p>
            <template v-else>
              <EntryList
                :lines="listed"
                :homes="homes"
                :categories="categories"
                :labels="labels"
                :picked="picked"
                :takes-receipt="takesReceipt"
                data-testid="spending-transactions-list"
                @open="openEntry"
                @pick="pick"
                @open-shared-cost="openSharedCost"
                @receipt="receiptPicker?.take($event)"
              />
              <ShowAllButton v-if="filters.manyMonths && rows.length > FIRST_SHOWN" v-model:expanded="allShown" :total="rows.length" class="px-4 pb-4 sm:px-5" />
            </template>
          </AppCard>
        </div>
      </template>
      <template #review>
        <ReviewPanel :takes-receipt="takesReceipt" @receipt="receiptPicker?.take($event)" @open="openEntry" />
      </template>
      <template #import>
        <ImportPanel />
      </template>
    </PageTabs>
    <EntryDialog v-if="state.workbook !== null" v-model:open="dialogOpen" :entry="editing" />
    <ReceiptDialog v-if="state.workbook !== null" v-model:open="receiptOpen" />
    <SharedCostDialog v-if="state.workbook !== null" v-model:open="sharedCostOpen" :shared-cost="openedSharedCost" :rows="openedSharedCost === null ? pickedRows : []" @made="picked = null" />
    <LabelPicker v-if="state.workbook !== null" v-model:open="pickerOpen" :rows="pickedRows" @done="picked = null" />
    <EventPicker v-if="state.workbook !== null && hasEvents" v-model:open="eventPickerOpen" :rows="pickedRows" @done="picked = null" />
    <ReceiptPhotoPicker v-if="assistKeyKept" ref="receiptPicker" />
  </section>
</template>
