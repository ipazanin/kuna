<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AccountDialog from './AccountDialog.vue'
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
import type { Account } from '../../workbook/domain/account'
import { today } from '../../../../shared/calendar/civilDate'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every account with what it holds today in its currency, and in euros beside a foreign one, under what the open ones hold and owe in all. Closed accounts come apart. */
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
        balance: formatAccountMoney(onDay.balance, onDay.account.currency),
        euro: euroLine(onDay, rates.value, day),
      })),
)

const sections = computed(() =>
  [
    { key: 'open', title: undefined, rows: shown.value.filter((row) => !row.account.closed), testid: 'spending-accounts-list' },
    { key: 'closed', title: words.closedAccounts, rows: shown.value.filter((row) => row.account.closed), testid: 'spending-closed-accounts' },
  ].filter((section) => section.rows.length > 0),
)

const unconverted = computed(() => (state.workbook === null || rates.value === 'loading' ? 0 : unconvertedCount(countedAccounts(state.workbook, day, everydayRates(rates.value)))))

/** The account's kind, bank and currency, and By hand only on a bank or savings account kept by hand, since that is the exception. */
function kindParts(account: Account): readonly string[] {
  const byHand = account.kind !== 'cash' && account.rowsFrom === 'by-hand' ? words.rowsFrom['by-hand'] : ''
  return [words.kinds[account.kind], account.bank === null ? '' : words.banks[account.bank], account.currency, byHand].filter((part) => part !== '')
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
          <template v-if="totals === 'opening'" #value>
            <span class="block type-body font-normal" data-testid="spending-bank-and-cash-waiting">{{ rateWords.loading }}</span>
          </template>
        </KpiTile>
        <KpiTile v-if="owed !== null" :label="homeWords.overdrawn" :value="formatMoney(owed.cents)" :to="null" icon="i-lucide-triangle-alert" icon-tone="warning" data-testid="spending-overdrawn" />
      </DashboardGrid>
      <p v-if="unconverted > 0" class="type-caption" data-testid="spending-not-converted">{{ plural(homeWords.notConverted(unconverted), unconverted) }}</p>
      <AppCard v-for="section in sections" :key="section.key" :title="section.title" :data-testid="section.testid">
        <ul class="flex flex-col py-2">
          <li v-for="row in section.rows" :key="row.account.id" class="border-t border-default first:border-t-0">
            <RouterLink :to="accountLink(row.account)" class="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-elevated sm:px-5" data-testid="spending-account-row">
              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="flex items-baseline justify-between gap-3">
                  <span class="min-w-0 break-words text-sm text-highlighted">{{ row.account.name }}</span>
                  <span class="figure shrink-0 text-sm text-highlighted" data-testid="spending-account-balance">{{ row.balance }}</span>
                </span>
                <span class="flex items-baseline justify-between gap-3 text-xs text-muted">
                  <span class="min-w-0" data-testid="spending-account-kind">
                    <template v-for="(part, place) in kindParts(row.account)" :key="place">
                      <template v-if="place > 0"> · </template>
                      <span class="whitespace-nowrap">{{ part }}</span>
                    </template>
                  </span>
                  <span v-if="row.euro !== null && row.euro.euros !== ''" class="figure shrink-0 text-toned" data-testid="spending-account-euros">{{ row.euro.euros }}</span>
                </span>
                <span v-if="row.euro !== null && row.euro.caption !== ''" class="text-end text-xs text-muted">{{ row.euro.caption }}</span>
              </span>
              <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </AppCard>
    </template>
    <AccountDialog v-if="state.workbook !== null" v-model:open="adding" :account="null" />
  </section>
</template>
