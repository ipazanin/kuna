<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { TRANSACTION_KINDS, listedTransactions, passesFilter } from '../domain/listedTransactions'
import type { ListedTransaction, TransactionKind, TransactionRecord } from '../domain/listedTransactions'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import TransactionDialog from './TransactionDialog.vue'
import { transactionLine } from './transactionLine'
import type { TransactionLine } from './transactionLine'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import { fold } from '../../../../shared/text/fold'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every record of the Investments file, newest first by month, found by kind, account, holding and words, each opening its dialog. */
const { state } = useInvestmentsBooks()
const { sources } = usePortfolio()
const wide = useMediaQuery('(min-width: 768px)')

/** Every filter's "all" choice, since a select cannot hold null. */
const ALL = 'all'

const kind = ref<TransactionKind | typeof ALL>(ALL)
const account = ref<string>(ALL)
const instrument = ref<string>(ALL)
const search = ref('')

const kindItems = [{ value: ALL, label: words.filters.allKinds }, ...TRANSACTION_KINDS.map((value) => ({ value, label: words.filters.kinds[value] }))]
const accountItems = computed(() => [
  { value: ALL, label: words.filters.allAccounts },
  ...(state.workbook?.book.accounts ?? []).map((candidate) => ({ value: candidate.id as string, label: candidate.name })),
])
const instrumentItems = computed(() => [
  { value: ALL, label: words.filters.allHoldings },
  ...(state.workbook?.book.instruments ?? []).map((candidate) => ({ value: candidate.id as string, label: candidate.name, description: candidate.symbol })),
])

const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book) && state.workbook.book.prices.length === 0)
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && sources.value === null))

interface Row extends TransactionLine {
  readonly entry: ListedTransaction
  readonly date: string
  readonly words: string
}

const listed = computed(() => (sources.value === null ? [] : listedTransactions(sources.value.book, sources.value.rates)))

const rows = computed((): Row[] => {
  const book = state.workbook?.book
  const filter = {
    kind: kind.value === ALL ? null : kind.value,
    account: book?.accounts.find((candidate) => candidate.id === account.value)?.id ?? null,
    instrument: book?.instruments.find((candidate) => candidate.id === instrument.value)?.id ?? null,
  }
  const query = fold(search.value)
  return listed.value
    .filter((entry) => passesFilter(entry, filter))
    .map((entry) => {
      const line = transactionLine(entry)
      return { ...line, entry, date: dayLabel(entry.record.date), words: fold([line.kind, line.subject, line.account, line.terms, line.moved, line.foreign, entry.record.note].join(' ')) }
    })
    .filter((row) => query === '' || row.words.includes(query))
})

const months = computed(() => {
  const groups: { key: string; label: string; rows: Row[] }[] = []
  for (const row of rows.value) {
    const month = monthOf(row.entry.record.date)
    const last = groups.at(-1)
    if (last?.key === month) last.rows.push(row)
    else groups.push({ key: month, label: monthLabel(month), rows: [row] })
  }
  return groups
})

const adding = ref(false)
const editing = ref<TransactionRecord | null>(null)
const changing = ref(false)

function change(entry: ListedTransaction): void {
  editing.value = entry
  changing.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" v-bind="listed.length === 0 ? {} : { description: plural(words.description(listed.length), listed.length) }">
      <template v-if="state.workbook !== null && !noTransactions" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="transactions-add" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="transactions-loading" />
    <EmptyState v-else-if="noTransactions" icon="i-lucide-arrow-left-right" :title="words.title" :description="words.emptyDescription" data-testid="transactions-empty">
      <template #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="transactions-add" @click="adding = true" />
      </template>
    </EmptyState>
    <AppCard v-else-if="state.workbook !== null" data-testid="transactions">
      <div class="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3 sm:px-5">
        <USelect v-model="kind" :items="kindItems" size="sm" :aria-label="words.filters.kind" class="w-full sm:w-52" data-testid="transactions-kind" />
        <USelect v-model="account" :items="accountItems" size="sm" :aria-label="words.filters.account" class="w-full sm:w-44" data-testid="transactions-account" />
        <USelectMenu
          v-model="instrument"
          :items="instrumentItems"
          value-key="value"
          :filter-fields="['label', 'description']"
          size="sm"
          :aria-label="words.filters.holding"
          class="w-full sm:w-52"
          data-testid="transactions-instrument"
        />
        <UInput v-model="search" icon="i-lucide-search" :placeholder="words.filters.search" :aria-label="words.filters.search" size="sm" class="w-full sm:w-56" data-testid="transactions-search" />
      </div>
      <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="transactions-none">{{ words.noMatch }}</p>
      <FigureTable v-else-if="wide" class="px-1 pb-2 sm:px-2" :label="words.title" data-testid="transactions-table">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.columns.date }}</th>
            <th scope="col" class="text-start">{{ words.columns.what }}</th>
            <th scope="col" class="text-start">{{ words.columns.account }}</th>
            <th scope="col" class="text-end">{{ words.columns.amount }}</th>
            <th scope="col" class="w-10">
              <span class="sr-only">{{ words.columns.change }}</span>
            </th>
          </tr>
        </thead>
        <tbody v-for="month in months" :key="month.key">
          <tr data-testid="transactions-month">
            <th scope="rowgroup" colspan="5" class="pt-4 text-start font-medium text-highlighted">
              {{ month.label }} <span class="type-caption font-normal">· {{ plural(words.inMonth(month.rows.length), month.rows.length) }}</span>
            </th>
          </tr>
          <tr v-for="row in month.rows" :key="row.entry.record.id" data-testid="transaction-row" :data-kind="row.entry.kind">
            <th scope="row" class="text-start align-top font-normal text-toned">{{ row.date }}</th>
            <td class="cell-wraps text-start">
              <span class="text-highlighted">{{ row.kind }}</span>
              <span class="block type-caption">{{ row.subject }}</span>
              <span v-if="row.terms !== ''" class="block type-caption">{{ row.terms }}</span>
            </td>
            <td class="cell-wraps text-start align-top text-toned">{{ row.account }}</td>
            <td class="cell-wraps text-end align-top">
              <MoneyText v-if="row.euros !== null" :cents="row.euros" :sign="row.flows ? 'always' : 'magnitude'" :tone="row.flows ? 'flow' : undefined" />
              <span v-else class="figure text-muted">{{ row.moved }}</span>
              <span v-if="row.euros !== null && row.moved !== ''" class="block type-caption">{{ row.moved }}</span>
              <span v-if="row.foreign !== ''" class="block type-caption">{{ row.foreign }}</span>
            </td>
            <td class="align-top">
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="words.change(row.kind, row.date)" data-testid="transaction-edit" @click="change(row.entry)" />
            </td>
          </tr>
        </tbody>
      </FigureTable>
      <div v-else class="pb-2" data-testid="transactions-rows">
        <section v-for="month in months" :key="month.key">
          <h2 class="flex items-baseline justify-between gap-3 border-t border-default px-4 pt-3 pb-1 type-label" data-testid="transactions-month">
            <span>{{ month.label }}</span>
            <span class="type-caption">{{ plural(words.inMonth(month.rows.length), month.rows.length) }}</span>
          </h2>
          <ul>
            <li
              v-for="row in month.rows"
              :key="row.entry.record.id"
              class="flex items-center gap-1 border-t border-default ps-4 pe-2 first:border-t-0"
              data-testid="transaction-row"
              :data-kind="row.entry.kind"
            >
              <span class="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5">
                <span class="flex items-baseline justify-between gap-3 type-body">
                  <span class="min-w-0 break-words text-highlighted">{{ row.kind }} · {{ row.subject }}</span>
                  <MoneyText v-if="row.euros !== null" :cents="row.euros" :sign="row.flows ? 'always' : 'magnitude'" :tone="row.flows ? 'flow' : undefined" class="shrink-0" />
                  <span v-else class="figure shrink-0 text-muted">{{ row.moved }}</span>
                </span>
                <span class="flex items-baseline justify-between gap-3 type-caption">
                  <span class="min-w-0 break-words">{{ [row.date, row.account].filter((part) => part !== '').join(' · ') }}</span>
                  <span v-if="row.euros !== null && row.moved !== ''" class="shrink-0">{{ row.moved }}</span>
                </span>
                <span v-if="row.terms !== '' || row.foreign !== ''" class="flex flex-wrap items-baseline gap-x-3 type-caption">
                  <span v-if="row.terms !== ''" class="min-w-0 break-words">{{ row.terms }}</span>
                  <span v-if="row.foreign !== ''" class="ms-auto">{{ row.foreign }}</span>
                </span>
              </span>
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" :aria-label="words.change(row.kind, row.date)" data-testid="transaction-edit" @click="change(row.entry)" />
            </li>
          </ul>
        </section>
      </div>
    </AppCard>
    <template v-if="state.workbook !== null">
      <TransactionDialog v-model:open="adding" :book="state.workbook.book" :editing="null" />
      <TransactionDialog v-model:open="changing" :book="state.workbook.book" :editing="editing" />
    </template>
  </section>
</template>
