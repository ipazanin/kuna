<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { PortfolioSources } from '../../holdings/domain/holding'
import { latestRecords } from '../../holdings/domain/latestRecords'
import { TRANSACTIONS_ROUTE } from '../../transactions/presentation/transactionLinks'
import { transactionLine } from '../../transactions/presentation/transactionLine'
import { words as transactionWords } from '../../transactions/presentation/words'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The five newest records of every kind, with a link to all of them. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const SHOWN = 5

const lines = computed(() =>
  latestRecords(props.sources.book, props.sources.rates, SHOWN).map((entry) => {
    const { date } = entry.record
    return { key: entry.record.id, date: yearOf(date) === yearOf(props.sources.today) ? shortDayLabel(date) : dayLabel(date), ...transactionLine(entry) }
  }),
)
</script>

<template>
  <AppCard :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="investments-latest">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.latest.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.latest.date }}</th>
          <th scope="col" class="text-start">{{ words.latest.what }}</th>
          <th scope="col" class="text-end">{{ words.latest.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.key" data-testid="investments-latest-row">
          <th scope="row" class="text-start font-normal text-toned">{{ line.date }}</th>
          <td class="cell-wraps text-start">
            <span class="text-highlighted">{{ line.kind }}</span>
            <span class="block type-caption">{{ line.subject }}</span>
          </td>
          <td class="text-end">
            <MoneyText v-if="line.euros !== null" :cents="line.euros" :sign="line.flows ? 'always' : 'magnitude'" :tone="line.flows ? 'flow' : undefined" />
            <span v-else class="figure text-muted">{{ line.moved }}</span>
            <span v-if="line.euros !== null && line.moved !== ''" class="block type-caption">{{ line.moved }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <div class="px-4 pb-4 sm:px-5">
      <UButton
        :to="TRANSACTIONS_ROUTE"
        :label="transactionWords.allTransactions"
        icon="i-lucide-arrow-right"
        trailing
        color="primary"
        variant="link"
        class="px-0"
        data-testid="investments-all-transactions"
      />
    </div>
  </AppCard>
</template>
