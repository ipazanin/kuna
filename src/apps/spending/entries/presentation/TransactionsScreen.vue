<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { filterCategoryChoices } from './categoryChoices'
import EntryDialog from './EntryDialog.vue'
import EntryList from './EntryList.vue'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { ALL_MONTHS, accountNamed, categoryIdNamed, labelNamed, SPENDING_ACCOUNTS_ROUTE, SPENDING_REVIEW_TAB } from '../../overview/presentation/spendingLinks'
import LabelPicker from './LabelPicker.vue'
import SelectionBar from './SelectionBar.vue'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { labelsOf } from '../../labels/domain/labels'
import { plural } from '../../../../shared/text/translation'
import { takesRowsByHand } from '../../workbook/domain/account'
import { categoriesOfRow } from '../../categories/domain/rowSide'
import { entriesNewestFirst } from '../../rates/domain/euroRows'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as screenWords } from '../../screenWords'
import ReceiptDialog from '../../receipts/presentation/ReceiptDialog.vue'
import ReceiptPhotoPicker from '../../receipts/presentation/ReceiptPhotoPicker.vue'
import { useReceiptRows } from '../../receipts/presentation/useReceiptRows'
import { receiptAccounts } from '../../receipts/domain/receiptMatch'
import { words as receiptWords } from '../../receipts/presentation/words'
import { toReviewCount } from '../../links/application/instalmentReview'
import ImportPanel from '../../statements/presentation/ImportPanel.vue'
import ReviewPanel from '../../statements/presentation/ReviewPanel.vue'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LABEL_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom, parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import MenuButton from '../../../../shared/ui/MenuButton.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The entries of a month or of every month by day, newest first, found by account, category and label, each opening the entry dialog and, while a key is kept, taking a receipt photo to the chat, or picked to be labelled while rows are being selected, with the rows to review and the statement import on tabs of their own. The filters live in `?month=`, `?account=`, `?category=` and `?label=`. */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const router = useRouter()
const thisMonth = monthOf(today())

/** Every filter's "all" choice, since a select cannot hold null. */
const ALL = 'all'

const accounts = computed(() => state.workbook?.accounts ?? [])
const categories = computed(() => state.workbook?.categories ?? [])
const transactions = computed(() => state.workbook?.transactions ?? [])
const labels = computed(() => state.workbook?.labels ?? [])

function replaceQuery(key: string, value: string | null): void {
  const { [key]: _left, ...others } = route.query
  void router.replace({ query: value === null ? others : { ...others, [key]: value } })
}

/** This month stays out of the address. */
const month = computed<MonthKey | typeof ALL_MONTHS>({
  get: () => (route.query.month === ALL_MONTHS ? ALL_MONTHS : ((typeof route.query.month === 'string' ? parseMonthKey(route.query.month) : null) ?? thisMonth)),
  set: (picked) => replaceQuery('month', picked === thisMonth ? null : picked),
})

const pickedAccount = computed(() => accountNamed(accounts.value, route.query.account))
const accountFilter = computed<string>({
  get: () => pickedAccount.value?.id ?? ALL,
  set: (id) => {
    const found = accounts.value.find((candidate) => candidate.id === id)
    replaceQuery('account', found === undefined ? null : keyOfRecordId(ACCOUNT_RECORDS, found.id))
  },
})

const pickedCategory = computed(() => {
  const id = categoryIdNamed(route.query.category)
  return categories.value.find((candidate) => candidate.id === id) ?? null
})
const categoryFilter = computed<string>({
  get: () => pickedCategory.value?.id ?? ALL,
  set: (id) => {
    const found = categories.value.find((candidate) => candidate.id === id)
    replaceQuery('category', found === undefined ? null : keyOfRecordId(CATEGORY_RECORDS, found.id))
  },
})

const pickedLabel = computed(() => labelNamed(labels.value, route.query.label))
/** Picking a label shows its entries of every month, and taking it off leaves every month showing until you pick one. */
const labelFilter = computed<string>({
  get: () => pickedLabel.value?.id ?? ALL,
  set: (id) => {
    const found = labels.value.find((candidate) => candidate.id === id)
    const { label: _label, ...others } = route.query
    void router.replace({ query: found === undefined ? others : { ...others, month: ALL_MONTHS, label: keyOfRecordId(LABEL_RECORDS, found.id) } })
  },
})

/** Every month, then each from the oldest entry's to this one, newest first, and the picked one when it lies outside them. */
const monthItems = computed(() => {
  const picked = month.value === ALL_MONTHS ? [] : [month.value]
  const known = [thisMonth, ...picked, ...[transactions.value[0], transactions.value.at(-1)].flatMap((row) => (row === undefined ? [] : [monthOf(row.date)]))].sort()
  return [
    { label: words.filters.allMonths, value: ALL_MONTHS },
    ...monthsFrom(known[0]!, known.at(-1)!)
      .reverse()
      .map((value) => ({ label: monthLabel(value), value })),
  ]
})
const labelItems = computed(() => [{ label: words.filters.allLabels, value: ALL }, ...labels.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string }))])
const accountItems = computed(() => [{ label: words.filters.allAccounts, value: ALL }, ...accounts.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string }))])
const categoryItems = computed(() => [[{ label: words.filters.allCategories, value: ALL }], ...filterCategoryChoices(categories.value)])

/** The picked category and, for a group, its children. */
const filedUnder = computed(() => {
  const picked = pickedCategory.value
  return picked === null ? null : new Set(categories.value.filter((candidate) => candidate.id === picked.id || candidate.parent === picked.id).map((candidate) => candidate.id))
})

const rows = computed(() => {
  const book = state.workbook
  if (book === null) return []
  const account = pickedAccount.value
  const under = filedUnder.value
  const label = pickedLabel.value
  const shown = month.value
  return entriesNewestFirst(book, everydayRates(rates.value)).filter(
    (row) =>
      (shown === ALL_MONTHS || monthOf(row.transaction.date) === shown) &&
      (account === null || row.transaction.account === account.id) &&
      (under === null || categoriesOfRow(row).some((id) => under.has(id))) &&
      (label === null || labelsOf(row.items).includes(label.id)),
  )
})

/** The entries picked to be labelled, or null while a tap opens an entry. A file from before items keeps no labels, so it offers its move instead. */
const picked = ref<ReadonlySet<RecordId> | null>(null)
const canLabel = computed(() => state.workbook !== null && !isBeforeItems(state.workbook.stored))
const pickedRows = computed(() => (picked.value === null ? [] : transactions.value.filter((row) => picked.value!.has(row.id))))
const pickerOpen = ref(false)

/** Every month at once shows its newest entries first and the rest behind Show all, since a few years of entries make a long list. */
const allShown = ref(false)
const listed = computed(() => (month.value !== ALL_MONTHS || allShown.value ? rows.value : rows.value.slice(0, FIRST_SHOWN)))

/** A new filter starts the list short again and drops the picks, so no entry out of sight stays picked. */
watch([month, accountFilter, categoryFilter, labelFilter], () => {
  allShown.value = false
  if (picked.value !== null) picked.value = new Set()
})

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

const canAdd = computed(() => accounts.value.some((candidate) => !candidate.closed && takesRowsByHand(candidate)))
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
        <SelectionBar
          v-if="picked !== null && transactions.length > 0"
          :summary="plural(words.labelling.picked(picked.size), picked.size)"
          :cancel-label="words.labelling.cancel"
          @cancel="picked = null"
        >
          <UButton :label="words.labelling.label" icon="i-lucide-tag" :disabled="picked.size === 0" data-testid="spending-selection-label" @click="pickerOpen = true" />
        </SelectionBar>
        <AppCard v-if="transactions.length > 0" data-testid="spending-transactions">
          <div class="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
            <USelect v-model="month" :items="monthItems" size="sm" :aria-label="words.filters.month" class="w-full sm:w-44" data-testid="spending-filter-month" />
            <USelect v-model="accountFilter" :items="accountItems" size="sm" :aria-label="words.filters.account" class="w-full sm:w-44" data-testid="spending-filter-account" />
            <USelectMenu
              v-model="categoryFilter"
              :items="categoryItems"
              value-key="value"
              :filter-fields="['label', 'description']"
              size="sm"
              :aria-label="words.filters.category"
              class="w-full sm:w-52"
              data-testid="spending-filter-category"
            />
            <USelect v-if="labels.length > 0" v-model="labelFilter" :items="labelItems" size="sm" :aria-label="words.filters.label" class="w-full sm:w-44" data-testid="spending-filter-label" />
            <UButton
              v-if="canLabel && picked === null && rows.length > 0"
              :label="words.labelling.select"
              :aria-label="words.labelling.selectHelp"
              icon="i-lucide-list-checks"
              size="sm"
              color="neutral"
              variant="outline"
              class="sm:ms-auto"
              data-testid="spending-select"
              @click="picked = new Set()"
            />
          </div>
          <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="spending-transactions-none">{{ words.noMatch }}</p>
          <template v-else>
            <EntryList
              :rows="listed"
              :categories="categories"
              :labels="labels"
              :picked="picked"
              :takes-receipt="takesReceipt"
              data-testid="spending-transactions-list"
              @open="openEntry"
              @pick="pick"
              @receipt="receiptPicker?.take($event)"
            />
            <ShowAllButton v-if="month === ALL_MONTHS && rows.length > FIRST_SHOWN" v-model:expanded="allShown" :total="rows.length" class="px-4 pb-4 sm:px-5" />
          </template>
        </AppCard>
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
    <LabelPicker v-if="state.workbook !== null" v-model:open="pickerOpen" :rows="pickedRows" @done="picked = null" />
    <ReceiptPhotoPicker v-if="assistKeyKept" ref="receiptPicker" />
  </section>
</template>
