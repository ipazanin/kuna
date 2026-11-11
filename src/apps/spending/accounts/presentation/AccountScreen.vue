<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import AccountDialog from './AccountDialog.vue'
import { euroLine } from './euroLine'
import { words } from './words'
import { accountBalance } from '../domain/accountBalance'
import EntryDialog from '../../entries/presentation/EntryDialog.vue'
import EntryList from '../../entries/presentation/EntryList.vue'
import { accountNamed, SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import { accountOnDay, euroRows } from '../../rates/domain/euroRows'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays, daysBetween, today } from '../../../../shared/calendar/civilDate'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'

/** One account: what it holds today, in euros too for a foreign one, its balance over the last 90 days, and its entries newest first, each opening the entry dialog. */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const day = today()

/** How many days back the balance line reaches, today included. */
const TREND_DAYS = 90

const account = computed(() => (state.workbook === null ? null : accountNamed(state.workbook.accounts, route.query.account)))
const transactions = computed(() => state.workbook?.transactions ?? [])

const onDay = computed(() => (account.value === null ? null : accountOnDay(account.value, transactions.value, day, everydayRates(rates.value))))
const euro = computed(() => (onDay.value === null ? null : euroLine(onDay.value, rates.value, day)))
const balanceCaption = computed(() => {
  if (euro.value === null) return ''
  if (euro.value.euros === '') return euro.value.caption === '' ? rateWords.failed : euro.value.caption
  return `${euro.value.euros} · ${euro.value.caption}`
})

const description = computed(() => {
  const shown = account.value
  if (shown === null) return ''
  return [words.kinds[shown.kind], shown.bank === null ? '' : words.banks[shown.bank], shown.currency, shown.iban, words.rowsFrom[shown.rowsFrom], shown.closed ? words.closed : '']
    .filter((part) => part !== '')
    .join(' · ')
})

const trendFrom = computed(() => {
  const shown = account.value
  if (shown === null) return day
  const start = addDays(day, 1 - TREND_DAYS)
  return shown.openedOn > start ? shown.openedOn : start
})
const trend = computed(() => {
  const shown = account.value
  if (shown === null || trendFrom.value > day) return []
  return Array.from({ length: daysBetween(trendFrom.value, day) + 1 }, (_, offset) => accountBalance(shown, transactions.value, addDays(trendFrom.value, offset)))
})

const rows = computed(() => {
  const book = state.workbook
  const shown = account.value
  if (book === null || shown === null) return []
  return euroRows({ accounts: [shown], transactions: book.transactions, lines: book.lines }, everydayRates(rates.value)).reverse()
})
const expanded = ref(false)
const listed = computed(() => (expanded.value ? rows.value : rows.value.slice(0, FIRST_SHOWN)))

const editing = ref(false)
const entryOpen = ref(false)
const entry = ref<Transaction | null>(null)

function openEntry(picked: Transaction): void {
  entry.value = picked
  entryOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <UButton :to="SPENDING_ACCOUNTS_ROUTE" :label="words.allAccounts" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="spending-back-to-accounts" />
    <template v-if="account !== null && onDay !== null">
      <PageHeader :title="account.name" :description="description">
        <template #actions>
          <UButton :label="words.edit" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="spending-account-edit" @click="editing = true" />
        </template>
      </PageHeader>
      <DashboardGrid layout="tiles">
        <KpiTile :label="words.balanceToday" :value="formatAccountMoney(onDay.balance, account.currency)" :caption="balanceCaption" :to="null" data-testid="spending-account-balance-today" />
      </DashboardGrid>
      <AppCard
        v-if="trend.length > 1"
        :title="words.trend.title"
        :subtitle="trendFrom === account.openedOn ? words.trend.sinceOpened(account.openedOn) : words.trend.lastDays"
        class="pb-4"
        data-testid="spending-account-trend"
      >
        <div class="px-4 sm:px-5">
          <SparkLine :points="trend" fill :height="56" zero-line />
        </div>
      </AppCard>
      <AppCard :title="words.entries" :subtitle="words.entriesSubtitle" data-testid="spending-account-entries">
        <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5">{{ words.noEntries }}</p>
        <template v-else>
          <EntryList :rows="listed" :categories="state.workbook?.categories ?? []" :show-account="false" heading="h3" @open="openEntry" />
          <ShowAllButton v-if="rows.length > FIRST_SHOWN" v-model:expanded="expanded" :total="rows.length" class="px-4 pb-4 sm:px-5" />
        </template>
      </AppCard>
      <AccountDialog v-model:open="editing" :account="account" />
      <EntryDialog v-model:open="entryOpen" :entry="entry" />
    </template>
    <ScreenSkeleton v-else-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="screenWords.account" />
      <AppCard>
        <p class="px-4 py-6 type-body sm:px-5" data-testid="spending-account-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
