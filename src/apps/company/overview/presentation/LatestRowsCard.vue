<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { useFilters } from '../../filters/application/filterStore'
import { rowDrill } from '../../filters/domain/drillTarget'
import { countedRowOf, latestBooked } from '../../transactions/domain/latestBooked'
import { words as transactionWords } from '../../transactions/presentation/words'
import type { DisplayNames } from '../../workbook/domain/displayName'
import { needsReview } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { recentDayLabel } from '../../../../shared/calendar/dayLabel'
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import RecordRow from '../../../../shared/ui/RecordRow.vue'

/**
 * The five rows the bank booked last on the accounts in view, each opening its row on Transactions, with a link to all of them. The card
 * spans its row, so from 42rem, the room a 1024 px window leaves beside the sidebar, it is a table with the columns of Transactions.
 */
const props = defineProps<{
  /** Every row of the accounts in view, as the bank booked it. */
  booked: readonly Transaction[]
  /** The rows as Transactions lists them, split and shared rows as their parts. */
  counted: readonly Transaction[]
  names: DisplayNames
}>()

const SHOWN = 5

const { drillLocation } = useFilters()
const day = today()

const table = roomAtLeast(42)

const lines = computed(() =>
  latestBooked(props.booked, SHOWN).map((row) => {
    const listed = countedRowOf(row, props.counted)
    const shown = { day: recentDayLabel(row.date, day), account: props.names.account(row.account), category: needsReview(row) ? transactionWords.tabs.review : props.names.category(row.category) }
    return {
      row,
      ...shown,
      title: row.counterparty || transactionWords.noCounterparty,
      caption: [shown.day, shown.account, shown.category].join(' · '),
      to: listed === null ? null : drillLocation(rowDrill(listed)),
    }
  }),
)
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="company-latest">
    <FigureTable v-if="table" class="mt-2 px-1 sm:px-2" :label="words.latest.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ transactionWords.columns.date }}</th>
          <th scope="col" class="text-start">{{ transactionWords.columns.counterparty }}</th>
          <th scope="col" class="text-start">{{ transactionWords.columns.category }}</th>
          <th scope="col" class="text-start">{{ transactionWords.columns.account }}</th>
          <th scope="col" class="text-end">{{ transactionWords.columns.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <RecordRow v-for="line in lines" :key="line.row.id" :to="line.to">
          <td class="align-top text-toned">{{ line.day }}</td>
          <th scope="row" class="cell-wraps text-start align-top font-normal">
            <DrillLink :to="line.to" class="text-highlighted" data-testid="company-latest-row">{{ line.title }}</DrillLink>
          </th>
          <td class="cell-wraps align-top text-toned">{{ line.category }}</td>
          <td class="cell-wraps align-top text-toned">{{ line.account }}</td>
          <td class="text-end align-top"><MoneyText :cents="line.row.amount" tone="flow" /></td>
        </RecordRow>
      </tbody>
    </FigureTable>
    <ul v-else class="row-list flex flex-col py-2">
      <li v-for="line in lines" :key="line.row.id" class="border-t border-default first:border-t-0">
        <ListRow v-if="line.to !== null" :to="line.to" :title="line.title" :caption="line.caption" data-testid="company-latest-row">
          <template #amount><MoneyText :cents="line.row.amount" tone="flow" /></template>
        </ListRow>
        <ListRow v-else as="div" :title="line.title" :caption="line.caption" data-testid="company-latest-row">
          <template #amount><MoneyText :cents="line.row.amount" tone="flow" /></template>
        </ListRow>
      </li>
    </ul>
    <div class="px-4 pb-4 sm:px-5">
      <UButton to="/company/transactions" :label="words.latest.allRows" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="px-0" data-testid="company-latest-all" />
    </div>
  </AppCard>
</template>
