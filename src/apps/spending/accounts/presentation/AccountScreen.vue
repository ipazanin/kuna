<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import AccountDialog from './AccountDialog.vue'
import AccountMoneyText from './AccountMoneyText.vue'
import { euroLine } from './euroLine'
import { words } from './words'
import { accountBalance } from '../domain/accountBalance'
import EntryDialog from '../../entries/presentation/EntryDialog.vue'
import { sharedCostHomes } from '../../sharedCosts/presentation/sharedCostNames'
import EntryList from '../../entries/presentation/EntryList.vue'
import ReceiptPhotoPicker from '../../receipts/presentation/ReceiptPhotoPicker.vue'
import { useReceiptRows } from '../../receipts/presentation/useReceiptRows'
import { accountNamed, SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import { accountOnDay, entriesNewestFirst } from '../../rates/domain/euroRows'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays, daysBetween, today } from '../../../../shared/calendar/civilDate'
import { sourceOfDay } from '../../workbook/domain/account'
import { sourceTallies } from '../domain/sourceTallies'
import ChangeListCard from '../../../../shared/ui/ChangeListCard.vue'
import type { ChangeLine } from '../../../../shared/ui/ChangeListCard.vue'
import type { RowOrigin } from '../../../../shared/app/accountSource'
import { plural } from '../../../../shared/text/translation'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import SparkLine from '../../../../shared/ui/SparkLine.vue'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'

/** One account: what it holds today, in euros too for a foreign one, its balance over the last 90 days, and its entries newest first, each opening the entry dialog and, while a key is kept, taking a receipt photo to the chat. */
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

/** The origins in the order a source line counts them. */
const ORIGINS: readonly RowOrigin[] = ['automation', 'provider-file', 'by-hand']

const description = computed(() => {
  const shown = account.value
  if (shown === null) return ''
  return [words.kinds[shown.kind], shown.bank ?? '', shown.currency, shown.iban, words.rowsFrom[sourceOfDay(shown, today())], shown.closed ? words.closed : '']
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
  return entriesNewestFirst({ accounts: [shown], transactions: book.transactions, items: book.items }, everydayRates(rates.value))
})
const expanded = ref(false)
const listed = computed(() => (expanded.value ? rows.value : rows.value.slice(0, FIRST_SHOWN)).map((row) => ({ kind: 'entry' as const, row })))
const homes = computed(() => sharedCostHomes(state.workbook))

/** One line for each source of the account's rows, with its days and how many rows each origin brought on them. */
const sourceLines = computed((): readonly ChangeLine[] => {
  const shown = account.value
  if (shown === null) return []
  return sourceTallies(shown, transactions.value).map(({ period, to, counts }, place) => {
    const from = dayLabel(period.from ?? shown.openedOn)
    const span = to === null ? words.sources.onwards(from) : words.sources.span(from, dayLabel(to))
    const brought = ORIGINS.filter((origin) => counts[origin] > 0).map((origin) => plural(words.sources.counts[origin](counts[origin]), counts[origin]))
    const title = words.rowsFrom[period.source]
    return { key: String(place), title, label: `${title}, ${span}`, detail: [span, ...(brought.length === 0 ? [words.sources.noRows] : brought)].join(' · ') }
  })
})

const editing = ref(false)
/** The place of the period whose Change opened the dialog, or null when Edit did. */
const changingPeriod = ref<number | null>(null)
const entryOpen = ref(false)
const entry = ref<Transaction | null>(null)

const takesReceipt = useReceiptRows()
const receiptPicker = useTemplateRef('receiptPicker')

function edit(period: number | null): void {
  changingPeriod.value = period
  editing.value = true
}

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
          <UButton :label="words.edit" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="spending-account-edit" @click="edit(null)" />
        </template>
      </PageHeader>
      <DashboardGrid layout="tiles">
        <KpiTile :label="words.balanceToday" :value="formatAccountMoney(onDay.balance, account.currency)" :caption="balanceCaption" :to="null" data-testid="spending-account-balance-today">
          <template #value>
            <AccountMoneyText :cents="onDay.balance" :currency="account.currency" tone="balance" />
          </template>
        </KpiTile>
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
      <ChangeListCard
        v-if="account.kind !== 'cash'"
        :title="words.sources.title"
        :subtitle="words.sources.subtitle"
        :lines="sourceLines"
        :empty="words.sources.empty"
        :can-add="false"
        collapse-id="spending-account-sources"
        data-testid="spending-account-sources-card"
        @change="edit(Number($event))"
      />
      <AppCard :title="words.entries" :subtitle="words.entriesSubtitle" data-testid="spending-account-entries">
        <p v-if="rows.length === 0" class="px-4 pb-4 type-body sm:px-5">{{ words.noEntries }}</p>
        <template v-else>
          <EntryList
            :lines="listed"
            :categories="state.workbook?.categories ?? []"
            :labels="state.workbook?.labels ?? []"
            :homes="homes"
            :show-account="false"
            heading="h3"
            :takes-receipt="takesReceipt"
            @open="openEntry"
            @receipt="receiptPicker?.take($event)"
          />
          <ShowAllButton v-if="rows.length > FIRST_SHOWN" v-model:expanded="expanded" :total="rows.length" class="px-4 pb-4 sm:px-5" />
        </template>
      </AppCard>
      <AccountDialog v-model:open="editing" :account="account" v-bind="changingPeriod === null ? {} : { period: changingPeriod }" />
      <EntryDialog v-model:open="entryOpen" :entry="entry" />
      <ReceiptPhotoPicker v-if="assistKeyKept" ref="receiptPicker" />
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
