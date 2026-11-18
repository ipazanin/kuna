<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { putOffPastOwnerPayments } from '../application/linkReview'
import type { ShownOwnerPayment } from '../application/linkReview'
import type { OwnerPaymentOffer } from '../domain/ownerPaymentOffers'
import { choiceText, words } from './words'
import { linkEntries } from '../../entries/application/entryWrites'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { rowCaption, rowTitle } from '../../statements/presentation/rowParts'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { EURO } from '../../../../shared/money/currencyCode'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The rows filed already that are payments between your company and you: each opens its entry, Link all links them in one write, and Not now stops offering them. */
const props = defineProps<{ offers: readonly OwnerPaymentOffer<ShownOwnerPayment>[] }>()

const emit = defineEmits<{ open: [entry: Transaction] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const count = computed(() => props.offers.length)
const allShown = ref(false)
const shown = computed(() => (allShown.value ? props.offers : props.offers.slice(0, FIRST_SHOWN)))
const accountOf = (row: Transaction): Account | undefined => store.state.workbook?.accounts.find((account) => account.id === row.account)

async function linkAll(): Promise<void> {
  const book = store.state.workbook
  const records = store.state.records
  if (book === null || records === null) return
  const links = props.offers.map(({ row, target }) => ({ row, target, currency: EURO }))
  await writes.write(plural(words.past.linked(links.length), links.length), (unit) => linkEntries(unit, records, links, { categories: book.categories, language, notes: words.notes }), {
    key: 'link-all-company',
    failedTitle: statementWords.review.notWritten,
  })
}

async function notNow(): Promise<void> {
  const book = store.state.workbook
  if (book !== null) await writes.write(words.payments.putOff, (unit) => putOffPastOwnerPayments(unit, book, props.offers), { key: 'not-now-company', failedTitle: statementWords.review.notWritten })
}
</script>

<template>
  <AppCard :title="words.payments.title" :subtitle="plural(words.payments.rows(count), count)" data-testid="spending-review-company-payments">
    <div class="flex flex-col gap-4 pt-1 pb-4">
      <ul class="divide-y divide-default">
        <li v-for="{ row, target } in shown" :key="row.id">
          <ListRow as="button" :title="rowTitle(row)" :caption="rowCaption(row, accountOf(row))" data-testid="spending-review-company-payments-row" @click="emit('open', row)">
            <template #amount>
              <AccountMoneyText :cents="row.amount" :currency="EURO" tone="flow" />
            </template>
            <template #details>
              <span class="break-words type-caption">{{ choiceText(target) }}</span>
            </template>
          </ListRow>
        </li>
      </ul>
      <div v-if="count > FIRST_SHOWN" class="px-4 sm:px-5">
        <ShowAllButton v-model:expanded="allShown" :total="count" />
      </div>
      <p class="px-4 text-sm text-muted sm:px-5">{{ words.payments.note }}</p>
      <div class="flex flex-wrap gap-2 px-4 sm:px-5">
        <UButton
          :label="plural(words.past.linkAll(count), count)"
          icon="i-lucide-link"
          :loading="writes.saving('link-all-company')"
          :disabled="writes.refused.value"
          data-testid="spending-review-company-payments-link"
          @click="linkAll"
        />
        <UButton
          :label="words.past.notNow"
          color="neutral"
          variant="ghost"
          :loading="writes.saving('not-now-company')"
          :disabled="writes.refused.value"
          data-testid="spending-review-company-payments-not-now"
          @click="notNow"
        />
      </div>
    </div>
  </AppCard>
</template>
