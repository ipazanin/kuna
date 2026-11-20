<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { ShownInstalment } from '../application/linkReview'
import type { ExtraPaymentOffer } from '../domain/instalmentOffers'
import ExtraPaymentForm from './ExtraPaymentForm.vue'
import { instalmentText, words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { rowCaption, rowTitle } from '../../statements/presentation/rowParts'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { EURO } from '../../../../shared/money/currencyCode'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** The rows a loan's rule filed whole above an instalment another row pays, each with Record as an extra payment, which adds it in Loans and links the row. */
const props = defineProps<{ offers: readonly ExtraPaymentOffer<ShownInstalment>[] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const allShown = ref(false)
const shown = computed(() => (allShown.value ? props.offers : props.offers.slice(0, FIRST_SHOWN)))
const accountOf = (row: Transaction): Account | undefined => store.state.workbook?.accounts.find((account) => account.id === row.account)

const recording = ref<ExtraPaymentOffer<ShownInstalment> | null>(null)
const dialogOpen = ref(false)
const saving = ref(false)

function record(offer: ExtraPaymentOffer<ShownInstalment>): void {
  recording.value = offer
  dialogOpen.value = true
}
</script>

<template>
  <AppCard :title="words.extra.title" :subtitle="words.extra.subtitle" data-testid="spending-review-extra-payments">
    <div class="flex flex-col gap-4 pt-1 pb-4">
      <ul class="divide-y divide-default">
        <ListRow
          v-for="offer in shown"
          :key="offer.row.id"
          :title="rowTitle(offer.row)"
          :caption="rowCaption(offer.row, accountOf(offer.row))"
          :data-with-instalment="offer.withInstalment || undefined"
          data-testid="spending-review-extra-payment"
        >
          <template #amount>
            <AccountMoneyText :cents="offer.row.amount" :currency="EURO" tone="flow" />
          </template>
          <template #details>
            <span class="break-words type-caption">{{ (offer.withInstalment ? words.extra.withInstalment : words.extra.caption)(instalmentText(offer.instalment)) }}</span>
          </template>
          <UButton class="self-start" :label="words.extra.record" icon="i-lucide-banknote" data-testid="spending-review-extra-payment-record" @click="record(offer)" />
        </ListRow>
      </ul>
      <div v-if="offers.length > FIRST_SHOWN" class="px-4 sm:px-5">
        <ShowAllButton v-model:expanded="allShown" :total="offers.length" />
      </div>
    </div>
    <AppDialog
      v-model:open="dialogOpen"
      changes
      :title="words.extra.dialogTitle"
      :description="recording === null ? undefined : (recording.withInstalment ? words.extra.splitDescription : words.extra.dialogDescription)(recording.instalment.loanName)"
    >
      <ExtraPaymentForm v-if="recording !== null" id="spending-extra-payment-form" :key="recording.row.id" v-model:saving="saving" :offer="recording" @recorded="dialogOpen = false" />
      <template #end>
        <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-extra-payment-cancel" @click="dialogOpen = false" />
        <UButton
          type="submit"
          form="spending-extra-payment-form"
          :label="words.extra.save"
          icon="i-lucide-link"
          :loading="saving"
          :disabled="writes.refused.value"
          data-testid="spending-extra-payment-save"
        />
      </template>
    </AppDialog>
  </AppCard>
</template>
