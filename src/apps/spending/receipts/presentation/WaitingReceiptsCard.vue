<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { placeWaitingReceipt, removeWaitingReceipt } from '../application/receiptWrites'
import { rowPlace } from '../domain/receiptSplit'
import { receiptOnRow } from '../domain/waitingReceipts'
import type { WaitingReceipt } from '../domain/waitingReceipts'
import { words as receiptDomainWords } from '../domain/words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import type { QuestionItem } from '../../../../shared/ui/QuestionList.vue'

/**
 * The receipts for card payments the bank has not brought yet. One that rows on its account may be asks which payment it is,
 * one that is clearly a row already on the file asks to go on it, and the rest wait. Each can be removed, with an Undo.
 */
const props = defineProps<{ waiting: readonly WaitingReceipt[] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const lines = computed(() => store.state.workbook?.items ?? [])

const KEEP = 'keep'
const REMOVE = 'remove'

const titleOf = ({ receipt }: WaitingReceipt): string => (receipt.merchant === '' ? words.waiting.noMerchant : receipt.merchant)
const captionOf = ({ receipt, account }: WaitingReceipt): string => `${dayLabel(receipt.issuedOn)} · ${account.name}`

type ReceiptQuestion = QuestionItem<string> & { readonly amount: AccountMoney }

function questionOf(item: WaitingReceipt): ReceiptQuestion {
  const candidates = item.matches.kind === 'none' ? [] : item.matches.candidates
  return {
    key: item.receipt.id,
    row: titleOf(item),
    caption: captionOf(item),
    choice: KEEP,
    amount: item.amount,
    options: [
      ...candidates.map(({ row }) => ({ value: row.id as string, label: `${dayLabel(row.date)} · ${formatAccountMoney(row.amount, EURO, 'magnitude')}` })),
      { value: KEEP, label: words.waiting.keep },
      { value: REMOVE, label: words.waiting.remove },
    ],
  }
}

/** The receipts that ask, a clear payment apart from those that could be several, each under the words for its kind. */
const asking = computed(() =>
  [
    { questions: props.waiting.filter((item) => item.matches.kind === 'ready').map(questionOf), intro: words.waiting.ready },
    { questions: props.waiting.filter((item) => item.matches.kind === 'pick').map(questionOf), intro: words.waiting.pick },
  ].filter(({ questions }) => questions.length > 0),
)
const quiet = computed(() => props.waiting.filter((item) => item.matches.kind === 'none'))

const saving = shallowRef<{ readonly key: string; readonly choice: string } | null>(null)
const card = useTemplateRef<ComponentPublicInstance>('card')

/** Puts focus that an answered question's buttons held on the next question, or on the card once none is left, so it never drops to the page. */
function keepFocus(): void {
  const root = card.value?.$el as HTMLElement | undefined
  if (root === undefined || (document.activeElement !== null && document.activeElement !== document.body)) return
  ;(root.querySelector<HTMLElement>('[data-testid="question-choice"] button') ?? root).focus()
}

defineExpose({ keepFocus })

async function remove({ receipt }: WaitingReceipt): Promise<boolean> {
  const records = store.state.records
  if (records === null) return false
  return writes.write(words.waiting.removed, (unit) => removeWaitingReceipt(unit, records, receipt), { key: `remove-${receipt.id}`, failedTitle: words.notSaved })
}

async function answer(key: string, choice: string): Promise<void> {
  const item = props.waiting.find((candidate) => candidate.receipt.id === key)
  if (item === undefined || choice === KEEP || saving.value !== null) return
  saving.value = { key, choice }
  try {
    if (choice === REMOVE) {
      await remove(item)
      return
    }
    const row = item.matches.kind === 'none' ? undefined : item.matches.candidates.find((candidate) => candidate.row.id === choice)?.row
    if (row === undefined) return
    const placed = receiptOnRow(item.receipt, item.lines, rowPlace(row, lines.value), receiptDomainWords.difference)
    await writes.write(words.waiting.placed, (unit) => placeWaitingReceipt(unit, placed), { key: `place-${key}`, failedTitle: words.notSaved })
  } finally {
    saving.value = null
    await nextTick()
    keepFocus()
  }
}
</script>

<template>
  <AppCard ref="card" :title="words.waiting.title" :subtitle="words.waiting.subtitle" tabindex="-1" data-testid="spending-review-receipts">
    <div class="flex flex-col pb-1">
      <div v-for="({ questions, intro }, at) in asking" :key="intro" :class="['px-4 py-3 sm:px-5', at > 0 && 'border-t border-default']">
        <QuestionList :items="questions" :options="[]" :label="words.waiting.putOn" :intro="intro" :saving="saving" data-testid="spending-review-receipt-place" @answer="answer">
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="EURO" sign="always" tone="flow" />
          </template>
        </QuestionList>
      </div>
      <ul v-if="quiet.length > 0" :class="['divide-y divide-default', asking.length > 0 ? 'border-t border-default' : 'pt-1']">
        <ProposalRow v-for="item in quiet" :key="item.receipt.id" :title="titleOf(item)" :caption="captionOf(item)" data-testid="spending-review-receipt">
          <template #amount>
            <AccountMoneyText :cents="item.amount" :currency="EURO" sign="always" tone="flow" />
          </template>
          <UButton
            class="self-start"
            :label="words.waiting.remove"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="writes.saving(`remove-${item.receipt.id}`)"
            data-testid="spending-review-receipt-remove"
            @click="remove(item)"
          />
        </ProposalRow>
      </ul>
    </div>
  </AppCard>
</template>
