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
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** The five rows the bank booked last on the accounts in view, each opening its row on Transactions, with a link to all of them. */
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

const lines = computed(() =>
  latestBooked(props.booked, SHOWN).map((row) => {
    const listed = countedRowOf(row, props.counted)
    return {
      row,
      title: row.counterparty || transactionWords.noCounterparty,
      caption: [recentDayLabel(row.date, day), props.names.account(row.account), needsReview(row) ? transactionWords.tabs.review : props.names.category(row.category)].join(' · '),
      to: listed === null ? null : drillLocation(rowDrill(listed)),
    }
  }),
)
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="company-latest">
    <ul class="flex flex-col py-2">
      <li v-for="line in lines" :key="line.row.id" class="border-t border-default first:border-t-0">
        <ProposalRow v-if="line.to !== null" :to="line.to" :title="line.title" :caption="line.caption" data-testid="company-latest-row">
          <template #amount><MoneyText :cents="line.row.amount" sign="always" tone="flow" /></template>
        </ProposalRow>
        <ProposalRow v-else as="div" :title="line.title" :caption="line.caption" data-testid="company-latest-row">
          <template #amount><MoneyText :cents="line.row.amount" sign="always" tone="flow" /></template>
        </ProposalRow>
      </li>
    </ul>
    <div class="px-4 pb-4 sm:px-5">
      <UButton to="/company/transactions" :label="words.latest.allRows" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" class="px-0" data-testid="company-latest-all" />
    </div>
  </AppCard>
</template>
