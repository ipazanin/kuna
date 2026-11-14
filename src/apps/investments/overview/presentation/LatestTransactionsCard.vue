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
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** The five newest records of every kind, each opening its record's dialog in place, with a link to all of them. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const SHOWN = 5

const lines = computed(() =>
  latestRecords(props.sources.book, props.sources.rates, SHOWN).map((entry) => {
    const line = transactionLine(entry)
    return {
      entry,
      ...line,
      caption: [recentDayLabel(entry.record.date, props.sources.today), line.subject, line.account === line.subject ? '' : line.account].filter((part) => part !== '').join(' · '),
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
    <ul class="flex flex-col py-2">
      <li v-for="line in lines" :key="line.entry.record.id" class="border-t border-default first:border-t-0">
        <ProposalRow as="button" :title="line.kind" :caption="line.caption" data-testid="investments-latest-row" @click="change(line.entry)">
          <template #amount>
            <MoneyText v-if="line.euros !== null" :cents="line.euros" :sign="line.flows ? 'always' : 'magnitude'" :tone="line.flows ? 'flow' : undefined" />
            <span v-else class="figure text-muted">{{ line.moved }}</span>
            <span v-if="line.euros !== null && line.moved !== ''" class="figure type-caption">{{ line.moved }}</span>
          </template>
        </ProposalRow>
      </li>
    </ul>
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
    <TransactionDialog v-model:open="changing" :book="sources.book" :editing="editing" />
  </AppCard>
</template>
