<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { filterCategoryChoices } from './categoryChoices'
import EntryDialog from './EntryDialog.vue'
import EntryList from './EntryList.vue'
import { words } from './words'
import { words as accountWords } from '../../accounts/presentation/words'
import { accountNamed, categoryIdNamed, SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import { euroRows } from '../../rates/domain/euroRows'
import { ratesIn } from '../../rates/domain/ratesState'
import { useRates } from '../../rates/presentation/useRates'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../../workbook/domain/spendingKinds'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom, parseMonthKey } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** The entries of a month by day, newest first, found by account and category, each opening the entry dialog. The filters live in `?month=`, `?account=` and `?category=`. */
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
  return euroRows(book, ratesIn(rates.value))
    .filter(
      ({ transaction }) =>
        monthOf(transaction.date) === month.value && (account === null || transaction.account === account.id) && (under === null || (transaction.category !== null && under.has(transaction.category))),
    )
    .reverse()
})

const canAdd = computed(() => accounts.value.some((candidate) => !candidate.closed))

const dialogOpen = ref(false)
const editing = ref<Transaction | null>(null)

function openEntry(entry: Transaction | null): void {
  editing.value = entry
  dialogOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.entries">
      <template v-if="canAdd" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-add-entry" @click="openEntry(null)" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="state.workbook === null && state.status !== 'error'" :heading="false" :cards="1" />
    <EmptyState
      v-else-if="state.workbook !== null && transactions.length === 0"
      icon="i-lucide-list"
      :title="words.noEntries"
      :description="canAdd ? words.noEntriesDescription : words.needsAccount"
      data-testid="spending-transactions-empty"
    >
      <template #actions>
        <UButton v-if="canAdd" :label="words.add" icon="i-lucide-plus" data-testid="spending-add-entry" @click="openEntry(null)" />
        <UButton v-else :label="accountWords.add" icon="i-lucide-landmark" :to="SPENDING_ACCOUNTS_ROUTE" data-testid="spending-go-to-accounts" />
      </template>
    </EmptyState>
    <AppCard v-else-if="state.workbook !== null" data-testid="spending-transactions">
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
      <EntryList v-else :rows="rows" :categories="categories" data-testid="spending-transactions-list" @open="openEntry" />
    </AppCard>
    <EntryDialog v-if="state.workbook !== null" v-model:open="dialogOpen" :entry="editing" />
  </section>
</template>
