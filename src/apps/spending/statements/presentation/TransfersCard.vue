<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { notAPair } from '../application/statementWrites'
import { words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Transaction } from '../../workbook/domain/transaction'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/** The transfers the pairing made, each of which Not a pair takes apart, and the lone legs waiting for their other side. */
defineProps<{
  pairs: readonly TransferPair[]
  loneLegs: readonly Transaction[]
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const accounts = computed(() => store.state.workbook?.accounts ?? [])
const accountOf = (row: Transaction) => accounts.value.find((account) => account.id === row.account)
const currencyOf = (row: Transaction) => accountOf(row)?.currency ?? EURO

async function undoPair(legs: TransferPair): Promise<void> {
  const records = store.state.records
  if (records !== null) await writes.write(words.review.pairUndone, (unit) => notAPair(unit, records, legs), { key: `not-a-pair-${legs.debit.id}`, failedTitle: words.review.notWritten })
}
</script>

<template>
  <AppCard :title="words.review.pairs" :subtitle="words.review.pairsSubtitle" data-testid="spending-pairs">
    <ul class="divide-y divide-default pt-1 pb-1">
      <ListRow
        v-for="legs in pairs"
        :key="legs.debit.id"
        :title="`${accountOf(legs.debit)?.name ?? ''} → ${accountOf(legs.credit)?.name ?? ''}`"
        :caption="dayLabel(legs.debit.date)"
        data-testid="spending-pair"
      >
        <template #amount>
          <AccountMoneyText :cents="legs.debit.amount" :currency="currencyOf(legs.debit)" tone="move" />
        </template>
        <UButton
          class="self-start"
          color="neutral"
          variant="outline"
          :label="words.review.notAPair"
          :loading="writes.saving(`not-a-pair-${legs.debit.id}`)"
          data-testid="spending-not-a-pair"
          @click="undoPair(legs)"
        />
      </ListRow>
      <ListRow v-for="leg in loneLegs" :key="leg.id" :title="leg.payee" :caption="`${dayLabel(leg.date)} · ${accountOf(leg)?.name ?? ''}`" data-testid="spending-lone-leg">
        <template #amount>
          <AccountMoneyText :cents="leg.amount" :currency="currencyOf(leg)" tone="move" />
        </template>
        <template #details>
          <UBadge
            :label="wantsSavingsAccount(leg, accounts) ? words.review.wantsSavings : words.review.waitingForOther"
            color="neutral"
            variant="subtle"
            size="sm"
            class="self-start"
            data-testid="spending-lone-leg-state"
          />
        </template>
      </ListRow>
    </ul>
  </AppCard>
</template>
