<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { putOffPastInstalments } from '../application/instalmentReview'
import type { ShownInstalment } from '../application/instalmentReview'
import type { PastInstalments } from '../domain/instalmentOffers'
import { instalmentText, words } from './words'
import { linkEntries } from '../../entries/application/entryWrites'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { rowCaption, rowTitle } from '../../statements/presentation/rowParts'
import { words as statementWords } from '../../statements/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** A loan's rows filed already that look like its instalments: each opens its entry, Link all links them in one write, and Not now stops offering them. */
const props = defineProps<{ card: PastInstalments<ShownInstalment> }>()

const emit = defineEmits<{ open: [entry: Transaction] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const count = computed(() => props.card.offers.length)
const span = computed(() => {
  const months = props.card.offers.map(({ row }) => monthOf(row.date)).sort()
  return { from: monthLabel(months[0]!), to: monthLabel(months[months.length - 1]!) }
})
const allShown = ref(false)
const shown = computed(() => (allShown.value ? props.card.offers : props.card.offers.slice(0, FIRST_SHOWN)))
const accountOf = (row: Transaction): Account | undefined => store.state.workbook?.accounts.find((account) => account.id === row.account)

async function linkAll(): Promise<void> {
  const book = store.state.workbook
  const records = store.state.records
  if (book === null || records === null) return
  const links = props.card.offers.map(({ row, target }) => ({ row, target, currency: EURO }))
  await writes.write(plural(words.past.linked(links.length), links.length), (unit) => linkEntries(unit, records, links, { categories: book.categories, language, notes: words.notes }), {
    key: `link-all-${props.card.loan}`,
    failedTitle: statementWords.review.notWritten,
  })
}

async function notNow(): Promise<void> {
  const book = store.state.workbook
  if (book !== null)
    await writes.write(words.past.putOff, (unit) => putOffPastInstalments(unit, book, props.card), { key: `not-now-${props.card.loan}`, failedTitle: statementWords.review.notWritten })
}
</script>

<template>
  <AppCard :title="words.past.title(card.loanName)" :subtitle="plural(words.past.rows(count, span.from, span.to), count)" data-testid="spending-review-instalments">
    <div class="flex flex-col gap-4 pt-1 pb-4">
      <ul class="divide-y divide-default">
        <li v-for="{ row, target } in shown" :key="row.id">
          <ProposalRow as="button" :title="rowTitle(row)" :caption="rowCaption(row, accountOf(row))" data-testid="spending-review-instalments-row" @click="emit('open', row)">
            <template #amount>
              <AccountMoneyText :cents="row.amount" :currency="EURO" sign="always" tone="flow" />
            </template>
            <template #details>
              <span class="break-words type-caption">{{ instalmentText(target) }}</span>
            </template>
          </ProposalRow>
        </li>
      </ul>
      <div v-if="count > FIRST_SHOWN" class="px-4 sm:px-5">
        <ShowAllButton v-model:expanded="allShown" :total="count" />
      </div>
      <p class="px-4 text-sm text-muted sm:px-5">{{ words.past.note }}</p>
      <div class="flex flex-wrap gap-2 px-4 sm:px-5">
        <UButton
          :label="plural(words.past.linkAll(count), count)"
          icon="i-lucide-link"
          :loading="writes.saving(`link-all-${card.loan}`)"
          :disabled="writes.refused.value"
          data-testid="spending-review-instalments-link"
          @click="linkAll"
        />
        <UButton
          :label="words.past.notNow"
          color="neutral"
          variant="ghost"
          :loading="writes.saving(`not-now-${card.loan}`)"
          :disabled="writes.refused.value"
          data-testid="spending-review-instalments-not-now"
          @click="notNow"
        />
      </div>
    </div>
  </AppCard>
</template>
