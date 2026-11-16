<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { rowTone } from '../../categories/presentation/amountTone'
import EntryDialog from '../../entries/presentation/EntryDialog.vue'
import { entryLine } from '../../entries/presentation/entryLine'
import { entriesNewestFirst } from '../../rates/domain/euroRows'
import { isSplit } from '../../workbook/domain/rowItems'
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
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import { words as entryWords } from '../../entries/presentation/words'

/**
 * The five newest entries by day, each opening its entry dialog in place, with a link to this month's entries. The card spans its row,
 * so from 42rem, the room a 1024 px window leaves beside the sidebar, it is a table whose columns carry each amount to its row's name.
 */
const props = defineProps<{
  book: SpendingBook
  rates: RateBook
  day: CivilDate
}>()

const SHOWN = 5

const byId = computed(() => new Map(props.book.categories.map((category) => [category.id, category])))
const table = roomAtLeast(42)

const lines = computed(() =>
  entriesNewestFirst(props.book, props.rates)
    .slice(0, SHOWN)
    .map((row) => {
      const { title, details, category } = entryLine(row, byId.value, true)
      const day = recentDayLabel(row.transaction.date, props.day)
      const split = isSplit(row.items)
      return {
        row,
        title,
        day,
        caption: [day, details].join(' · '),
        payee: row.transaction.payee,
        category: split ? words.latest.splitEntry : (category?.name ?? entryWords.waitsOnReview),
        note: split ? '' : (row.items[0]?.note ?? ''),
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
    <FigureTable v-if="table" class="mt-2 px-1 sm:px-2" :label="words.latest.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.latest.columns.day }}</th>
          <th scope="col" class="text-start">{{ words.latest.columns.payee }}</th>
          <th scope="col" class="text-start">{{ words.latest.columns.category }}</th>
          <th scope="col" class="text-start">{{ words.latest.columns.account }}</th>
          <th scope="col" class="text-end">{{ words.latest.columns.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.row.transaction.id" class="cursor-pointer transition-colors hover:bg-elevated" @click="openEntry(line.row.transaction)">
          <td class="align-top text-toned">{{ line.day }}</td>
          <th scope="row" class="cell-wraps text-start align-top font-normal">
            <button v-if="line.payee !== ''" type="button" class="text-start text-highlighted" data-testid="spending-latest-row">{{ line.payee }}</button>
            <button v-else type="button" class="text-muted" :aria-label="line.title" data-testid="spending-latest-row">–</button>
            <span v-if="line.note !== ''" class="block type-caption">{{ line.note }}</span>
          </th>
          <td class="cell-wraps align-top text-toned">{{ line.category }}</td>
          <td class="cell-wraps align-top text-toned">{{ line.row.account.name }}</td>
          <td class="text-end align-top">
            <AccountMoneyText :cents="line.row.transaction.amount" :currency="line.row.account.currency" :tone="rowTone(line.row.items, book.categories)" />
            <span v-if="line.euros !== ''" class="block figure type-caption">{{ line.euros }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <ul v-else class="near-figures flex flex-col py-2">
      <li v-for="line in lines" :key="line.row.transaction.id" class="border-t border-default first:border-t-0">
        <ListRow as="button" :title="line.title" :caption="line.caption" data-testid="spending-latest-row" @click="openEntry(line.row.transaction)">
          <template #amount>
            <AccountMoneyText :cents="line.row.transaction.amount" :currency="line.row.account.currency" :tone="rowTone(line.row.items, book.categories)" />
            <span v-if="line.euros !== ''" class="figure type-caption">{{ line.euros }}</span>
          </template>
        </ListRow>
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
