<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { filterCategoryChoices } from './categoryChoices'
import EntryDialog from './EntryDialog.vue'
import EntryList from './EntryList.vue'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { accountNamed, categoryIdNamed, SPENDING_ACCOUNTS_ROUTE, SPENDING_REVIEW_TAB } from '../../overview/presentation/spendingLinks'
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
import { reviewCount } from '../../statements/domain/reviewQueue'
import ImportPanel from '../../statements/presentation/ImportPanel.vue'
import ReviewPanel from '../../statements/presentation/ReviewPanel.vue'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom, parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import MenuButton from '../../../../shared/ui/MenuButton.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** The entries of a month by day, newest first, found by account and category, each opening the entry dialog and, while a key is kept, taking a receipt photo to the chat, with the rows to review and the statement import on tabs of their own. The filters live in `?month=`, `?account=` and `?category=`. */
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

function replaceQuery(key: string, value: string | null): void {
  const { [key]: _left, ...others } = route.query
  void router.replace({ query: value === null ? others : { ...others, [key]: value } })
}

/** This month stays out of the address. */
const month = computed<MonthKey>({
  get: () => (typeof route.query.month === 'string' ? parseMonthKey(route.query.month) : null) ?? thisMonth,
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

/** Every month from the oldest entry's to this one, newest first, and the picked one when it lies outside them. */
const monthItems = computed(() => {
  const known = [thisMonth, month.value, ...[transactions.value[0], transactions.value.at(-1)].flatMap((row) => (row === undefined ? [] : [monthOf(row.date)]))].sort()
  return monthsFrom(known[0]!, known.at(-1)!)
    .reverse()
    .map((value) => ({ label: monthLabel(value), value }))
})
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
  return entriesNewestFirst(book, everydayRates(rates.value)).filter(
    (row) => monthOf(row.transaction.date) === month.value && (account === null || row.transaction.account === account.id) && (under === null || categoriesOfRow(row).some((id) => under.has(id))),
  )
})

const tabs = computed(() => [
  { value: 'entries', label: screenWords.entries, icon: 'i-lucide-list' },
  { value: SPENDING_REVIEW_TAB, label: statementWords.tabs.review, icon: 'i-lucide-inbox', count: state.workbook === null ? 0 : reviewCount(state.workbook) },
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
        <AppCard v-else data-testid="spending-transactions">
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
          </div>
          <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="spending-transactions-none">{{ words.noMatch }}</p>
          <EntryList v-else :rows="rows" :categories="categories" :takes-receipt="takesReceipt" data-testid="spending-transactions-list" @open="openEntry" @receipt="receiptPicker?.take($event)" />
        </AppCard>
      </template>
      <template #review>
        <ReviewPanel :takes-receipt="takesReceipt" @receipt="receiptPicker?.take($event)" />
      </template>
      <template #import>
        <ImportPanel />
      </template>
    </PageTabs>
    <EntryDialog v-if="state.workbook !== null" v-model:open="dialogOpen" :entry="editing" />
    <ReceiptDialog v-if="state.workbook !== null" v-model:open="receiptOpen" />
    <ReceiptPhotoPicker v-if="assistKeyKept" ref="receiptPicker" />
  </section>
</template>
