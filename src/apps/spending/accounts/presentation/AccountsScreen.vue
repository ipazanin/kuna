<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AccountDialog from './AccountDialog.vue'
import AccountMoneyText from './AccountMoneyText.vue'
import { accountsOnDay } from './accountsOnDay'
import { euroLine } from './euroLine'
import { words } from './words'
import { spendingHubFigures } from '../../home/presentation/spendingHubFigures'
import { words as homeWords } from '../../home/presentation/words'
import { accountLink } from '../../overview/presentation/spendingLinks'
import { countedAccounts, unconvertedCount } from '../../rates/domain/euroRows'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { sourceOfDay } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { today } from '../../../../shared/calendar/civilDate'
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import { negateMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import RecordRow from '../../../../shared/ui/RecordRow.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * Every account with what it holds today in its currency, and in euros beside a foreign one, under what the open ones hold and owe in all.
 * Closed accounts come apart, in a card under the open ones. Each card spans the page, so from 42rem, the room a 1024 px window leaves
 * beside the sidebar, its accounts are a table whose columns carry each balance to its account's name. The In euros column shows only
 * in a card that holds a foreign account.
 */
const { state } = useSpendingBooks()
const rates = useRates()
const day = today()

const totals = computed(() => (state.workbook === null ? null : spendingHubFigures(state.workbook, rates.value, day)))
const held = computed(() => (totals.value === null || totals.value === 'opening' ? null : (totals.value.parts.find((part) => part.side === 'has') ?? null)))
const owed = computed(() => (totals.value === null || totals.value === 'opening' ? null : (totals.value.parts.find((part) => part.side === 'owes') ?? null)))

const shown = computed(() =>
  state.workbook === null
    ? []
    : accountsOnDay(state.workbook, day, everydayRates(rates.value)).map((onDay) => ({
        account: onDay.account,
        balance: onDay.balance,
        euro: euroLine(onDay, rates.value, day),
      })),
)

const sections = computed(() =>
  [
    { key: 'open', title: undefined, rows: shown.value.filter((row) => !row.account.closed), testid: 'spending-accounts-list' },
    { key: 'closed', title: words.closedAccounts, rows: shown.value.filter((row) => row.account.closed), testid: 'spending-closed-accounts' },
  ]
    .filter((section) => section.rows.length > 0)
    .map((section) => ({ ...section, foreign: section.rows.some((row) => row.euro !== null) })),
)

const table = roomAtLeast(42)

const unconverted = computed(() => (state.workbook === null || rates.value === 'loading' ? 0 : unconvertedCount(countedAccounts(state.workbook, day, everydayRates(rates.value)))))

/** The account's kind, bank and currency, and By hand only on a bank or savings account kept by hand today, since that is the exception. */
function kindParts(account: Account): readonly string[] {
  const byHand = account.kind !== 'cash' && sourceOfDay(account, day) === 'by-hand' ? words.rowsFrom['by-hand'] : ''
  return [words.kinds[account.kind], account.bank ?? '', account.currency, byHand].filter((part) => part !== '')
}

const adding = ref(false)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.accounts">
      <template v-if="state.workbook !== null" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-add-account" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="state.workbook === null && state.status !== 'error'" :heading="false" :cards="2" />
    <EmptyState
      v-else-if="state.workbook !== null && totals === null"
      icon="i-lucide-landmark"
      :title="words.noAccounts"
      :description="words.noAccountsDescription"
      data-testid="spending-accounts-empty"
    >
      <template #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-add-account" @click="adding = true" />
      </template>
    </EmptyState>
    <template v-else-if="state.workbook !== null">
      <DashboardGrid layout="tiles">
        <KpiTile :label="homeWords.bankAndCash" :value="held === null ? '' : formatMoney(held.cents)" :caption="held?.caption ?? ''" :to="null" data-testid="spending-bank-and-cash">
          <template #value>
            <span v-if="totals === 'opening'" class="block type-body font-normal" data-testid="spending-bank-and-cash-waiting">{{ rateWords.loading }}</span>
            <MoneyText v-else-if="held !== null" :cents="held.cents" tone="balance" />
          </template>
        </KpiTile>
        <KpiTile
          v-if="owed !== null"
          :label="homeWords.overdrawn"
          :value="formatMoney(negateMoney(owed.cents))"
          :to="null"
          icon="i-lucide-triangle-alert"
          icon-tone="warning"
          data-testid="spending-overdrawn"
        >
          <template #value>
            <MoneyText :cents="negateMoney(owed.cents)" tone="balance" />
          </template>
        </KpiTile>
      </DashboardGrid>
      <p v-if="unconverted > 0" class="type-caption" data-testid="spending-not-converted">{{ plural(homeWords.notConverted(unconverted), unconverted) }}</p>
      <AppCard v-for="section in sections" :key="section.key" :title="section.title" :data-testid="section.testid">
        <FigureTable v-if="table" class="px-1 py-2 sm:px-2" :label="section.title ?? screenWords.accounts">
          <thead>
            <tr>
              <th scope="col" class="text-start">{{ words.columns.account }}</th>
              <th scope="col" class="text-start">{{ words.columns.kind }}</th>
              <th scope="col" class="text-end">{{ words.columns.balance }}</th>
              <th v-if="section.foreign" scope="col" class="text-end">{{ words.columns.inEuros }}</th>
            </tr>
          </thead>
          <tbody>
            <RecordRow v-for="row in section.rows" :key="row.account.id" :to="accountLink(row.account)" data-testid="spending-account-row">
              <th scope="row" class="cell-wraps text-start align-top font-normal">
                <DrillLink :to="accountLink(row.account)" class="inline-flex items-center gap-1 text-highlighted">
                  <span>{{ row.account.name }}</span
                  ><UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
                </DrillLink>
              </th>
              <td class="cell-wraps align-top text-toned" data-testid="spending-account-kind">{{ kindParts(row.account).join(' · ') }}</td>
              <td class="text-end align-top">
                <AccountMoneyText :cents="row.balance" :currency="row.account.currency" tone="balance" data-testid="spending-account-balance" />
              </td>
              <td v-if="section.foreign" class="text-end align-top">
                <span v-if="row.euro !== null && row.euro.euros !== ''" class="figure text-toned" data-testid="spending-account-euros">{{ row.euro.euros }}</span>
                <span v-if="row.euro !== null && row.euro.caption !== ''" class="block type-caption">{{ row.euro.caption }}</span>
              </td>
            </RecordRow>
          </tbody>
        </FigureTable>
        <ul v-else class="flex flex-col py-2">
          <li v-for="row in section.rows" :key="row.account.id" class="border-t border-default first:border-t-0">
            <ListRow :to="accountLink(row.account)" :title="row.account.name" data-testid="spending-account-row">
              <template #amount>
                <span class="text-highlighted"><AccountMoneyText :cents="row.balance" :currency="row.account.currency" tone="balance" data-testid="spending-account-balance" /></span>
                <span v-if="row.euro !== null && row.euro.euros !== ''" class="figure type-caption" data-testid="spending-account-euros">{{ row.euro.euros }}</span>
              </template>
              <template #caption>
                <span data-testid="spending-account-kind">
                  <template v-for="(part, place) in kindParts(row.account)" :key="place">
                    <template v-if="place > 0"> · </template>
                    <span class="whitespace-nowrap">{{ part }}</span>
                  </template>
                </span>
              </template>
              <template v-if="row.euro !== null && row.euro.caption !== ''" #details>
                <span class="text-end type-caption">{{ row.euro.caption }}</span>
              </template>
            </ListRow>
          </li>
        </ul>
      </AppCard>
    </template>
    <AccountDialog v-if="state.workbook !== null" v-model:open="adding" :account="null" />
  </section>
</template>
