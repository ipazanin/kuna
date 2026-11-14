<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import EntryDialog from '../../entries/presentation/EntryDialog.vue'
import { entryLine } from '../../entries/presentation/entryLine'
import { entriesNewestFirst } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { Transaction } from '../../workbook/domain/transaction'
import { transactionsLink } from './spendingLinks'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { recentDayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { RateBook } from '../../../../shared/money/rateBook'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** The five newest entries by day, each opening its entry dialog in place, with a link to this month's entries. */
const props = defineProps<{
  book: SpendingBook
  rates: RateBook
  day: CivilDate
}>()

const SHOWN = 5

const byId = computed(() => new Map(props.book.categories.map((category) => [category.id, category])))
const lines = computed(() =>
  entriesNewestFirst(props.book, props.rates)
    .slice(0, SHOWN)
    .map((row) => {
      const { title, details } = entryLine(row, byId.value, true)
      return {
        row,
        title,
        caption: [recentDayLabel(row.transaction.date, props.day), details].join(' · '),
        euros: row.account.currency === EURO || row.euros === null ? '' : formatMoney(row.euros, 'always'),
      }
    }),
)

const entryOpen = ref(false)
const entry = ref<Transaction | null>(null)

function openEntry(picked: Transaction): void {
  entry.value = picked
  entryOpen.value = true
}
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="spending-latest">
    <ul class="flex flex-col py-2">
      <li v-for="line in lines" :key="line.row.transaction.id" class="border-t border-default first:border-t-0">
        <ProposalRow as="button" :title="line.title" :caption="line.caption" data-testid="spending-latest-row" @click="openEntry(line.row.transaction)">
          <template #amount>
            <AccountMoneyText :cents="line.row.transaction.amount" :currency="line.row.account.currency" sign="always" tone="flow" />
            <span v-if="line.euros !== ''" class="figure type-caption">{{ line.euros }}</span>
          </template>
        </ProposalRow>
      </li>
    </ul>
    <div class="px-4 pb-4 sm:px-5">
      <UButton
        :to="transactionsLink(monthOf(day))"
        :label="words.latest.allEntries"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="link"
        class="px-0"
        data-testid="spending-latest-all"
      />
    </div>
    <EntryDialog v-model:open="entryOpen" :entry="entry" />
  </AppCard>
</template>
