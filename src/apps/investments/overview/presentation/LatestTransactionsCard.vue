<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { PortfolioSources } from '../../holdings/domain/holding'
import { latestRecords } from '../../holdings/domain/latestRecords'
import type { TransactionRecord } from '../../transactions/domain/listedTransactions'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import { TRANSACTIONS_ROUTE } from '../../transactions/presentation/transactionLinks'
import { transactionLine } from '../../transactions/presentation/transactionLine'
import { words as transactionWords } from '../../transactions/presentation/words'
import { words } from './words'
import { recentDayLabel } from '../../../../shared/calendar/dayLabel'
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/**
 * The five newest records of every kind, each opening its record's dialog in place, with a link to all of them. The card spans its row,
 * so from 42rem, the room a 1024 px window leaves beside the sidebar, it is a table with the columns of Transactions.
 */
const props = defineProps<{
  sources: PortfolioSources
}>()

const SHOWN = 5

const table = roomAtLeast(42)

const lines = computed(() =>
  latestRecords(props.sources.book, props.sources.rates, SHOWN).map((entry) => {
    const line = transactionLine(entry)
    const day = recentDayLabel(entry.record.date, props.sources.today)
    return {
      entry,
      ...line,
      day,
      caption: [day, line.subject, line.account === line.subject ? '' : line.account].filter((part) => part !== '').join(' · '),
    }
  }),
)

const editing = ref<TransactionRecord | null>(null)
const changing = ref(false)

function change(entry: TransactionRecord): void {
  editing.value = entry
  changing.value = true
}
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="investments-latest">
    <FigureTable v-if="table" class="mt-2 px-1 sm:px-2" :label="words.latest.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ transactionWords.columns.date }}</th>
          <th scope="col" class="text-start">{{ transactionWords.columns.what }}</th>
          <th scope="col" class="text-start">{{ transactionWords.columns.account }}</th>
          <th scope="col" class="text-end">{{ transactionWords.columns.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.entry.record.id" class="cursor-pointer transition-colors hover:bg-elevated" @click="change(line.entry)">
          <td class="align-top text-toned">{{ line.day }}</td>
          <th scope="row" class="cell-wraps text-start align-top font-normal">
            <button type="button" class="text-start text-highlighted" data-testid="investments-latest-row">{{ line.kind }}</button>
            <span class="block type-caption">{{ line.subject }}</span>
          </th>
          <td class="cell-wraps align-top text-toned">{{ line.account }}</td>
          <td class="text-end align-top">
            <MoneyText v-if="line.euros !== null" :cents="line.euros" v-bind="line.flows ? { tone: 'flow' } : { sign: 'magnitude' }" />
            <span v-else class="figure text-muted">{{ line.moved }}</span>
            <span v-if="line.euros !== null && line.moved !== ''" class="block figure type-caption">{{ line.moved }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <ul v-else class="near-figures flex flex-col py-2">
      <li v-for="line in lines" :key="line.entry.record.id" class="border-t border-default first:border-t-0">
        <ListRow as="button" :title="line.kind" :caption="line.caption" data-testid="investments-latest-row" @click="change(line.entry)">
          <template #amount>
            <MoneyText v-if="line.euros !== null" :cents="line.euros" v-bind="line.flows ? { tone: 'flow' } : { sign: 'magnitude' }" />
            <span v-else class="figure text-muted">{{ line.moved }}</span>
            <span v-if="line.euros !== null && line.moved !== ''" class="figure type-caption">{{ line.moved }}</span>
          </template>
        </ListRow>
      </li>
    </ul>
    <div class="px-4 pb-4 sm:px-5">
      <UButton
        :to="TRANSACTIONS_ROUTE"
        :label="transactionWords.allTransactions"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="link"
        class="px-0"
        data-testid="investments-all-transactions"
      />
    </div>
    <TransactionDialog v-model:open="changing" :book="sources.book" :editing="editing" />
  </AppCard>
</template>
