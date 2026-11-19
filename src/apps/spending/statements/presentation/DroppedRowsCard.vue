<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { DROPPED_ROW_WRITES } from '../application/ruleRecords'
import { rowCaption } from './rowParts'
import { words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { DroppedRow } from '../../workbook/domain/droppedRow'
import { EURO } from '../../../../shared/money/currencyCode'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/** The payments the bank dropped that you had filed, each naming how you filed it, until you press OK on it. */
defineProps<{ dropped: readonly DroppedRow[] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const book = computed(() => store.state.workbook)
const accountOf = (dropped: DroppedRow) => book.value?.accounts.find((account) => account.id === dropped.account)

async function seen(dropped: DroppedRow): Promise<void> {
  await writes.write(words.review.dropped.seen, (unit) => unit.of(DROPPED_ROW_WRITES).remove(dropped), { key: `dropped-${dropped.id}`, failedTitle: words.review.notWritten })
}
</script>

<template>
  <AppCard :title="words.review.dropped.title" :subtitle="words.review.dropped.subtitle" data-testid="spending-review-dropped">
    <ul class="divide-y divide-default pt-1 pb-1">
      <ListRow v-for="row in dropped" :key="row.id" :title="row.payee" :caption="rowCaption(row, accountOf(row))" data-testid="spending-review-dropped-row">
        <template #amount>
          <AccountMoneyText :cents="row.amount" :currency="accountOf(row)?.currency ?? EURO" sign="always" />
        </template>
        <template #details>
          <span v-if="row.filing !== ''" class="type-caption" data-testid="spending-review-dropped-filing">{{ words.review.dropped.filedAs(row.filing) }}</span>
        </template>
        <div class="flex">
          <UButton :label="words.review.dropped.ok" color="neutral" variant="outline" :loading="writes.saving(`dropped-${row.id}`)" data-testid="spending-review-dropped-ok" @click="seen(row)" />
        </div>
      </ListRow>
    </ul>
  </AppCard>
</template>
