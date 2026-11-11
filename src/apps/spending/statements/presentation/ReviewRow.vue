<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { WaitingRow } from '../domain/reviewQueue'
import { words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { entryAsked } from '../../entries/presentation/entryAsked'
import ReceiptCameraButton from '../../receipts/presentation/ReceiptCameraButton.vue'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { EURO } from '../../../../shared/money/currencyCode'
import { absAccountMoney } from '../../../../shared/money/accountMoney'

/** One row waiting for a category: picking one files it, the chat can be asked about it or given its receipt beside the picker, and what the file offers for it sits underneath. */
const props = defineProps<{
  waiting: WaitingRow
  categories: readonly Category[]
  accounts: readonly Account[]
  /** What a rule would file this row under, offered beside joining it with what you typed. */
  ruleCategory: Category | null
  takesReceipt: boolean
}>()

const emit = defineEmits<{
  file: [category: Category]
  join: []
  pair: []
  receipt: [entry: AskedElement]
}>()

const accountOf = (id: string): Account | undefined => props.accounts.find((account) => account.id === id)

const account = computed(() => accountOf(props.waiting.row.account))
const currency = computed(() => account.value?.currency ?? EURO)
const asked = computed(() => entryAsked(props.waiting.row, account.value))
const { ask, marked } = useChatElement(asked, 'row')

const items = computed(() => entryCategoryChoices(props.categories, props.waiting.row.amount < 0 ? 'out' : 'in', null, true))

const typedLine = computed(() => {
  const match = props.waiting.maybeTyped
  if (match === null) return null
  return match.difference === 0 ? words.review.maybeApart(match.typed.date) : words.review.maybeDifferent(formatAccountMoney(absAccountMoney(match.difference), currency.value))
})

const transferLine = computed(() => {
  const pair = props.waiting.maybeTransfer
  if (pair === null) return null
  const other = pair.debit === props.waiting.row ? pair.credit : pair.debit
  return words.review.maybeTransfer(accountOf(other.account)?.name ?? '')
})

function picked(id: string | undefined): void {
  const category = props.categories.find((candidate) => candidate.id === id)
  if (category !== undefined) emit('file', category)
}
</script>

<template>
  <li class="flex flex-col gap-2 px-4 py-3 sm:px-5" v-bind="marked" data-testid="spending-review-row">
    <div class="flex items-start gap-3">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="break-words text-sm text-highlighted">{{ waiting.row.payee || waiting.row.description }}</span>
        <span class="break-words type-caption">{{ [dayLabel(waiting.row.date), account?.name ?? ''].filter((part) => part !== '').join(' · ') }}</span>
      </span>
      <AccountMoneyText :cents="waiting.row.amount" :currency="currency" sign="always" tone="flow" class="shrink-0 text-sm" />
    </div>
    <div class="flex items-center gap-2">
      <USelectMenu
        :items="items"
        value-key="value"
        :placeholder="words.review.category"
        :aria-label="words.review.pickCategory"
        class="min-w-0 flex-1 sm:w-72 sm:flex-none"
        data-testid="spending-review-category"
        @update:model-value="picked"
      />
      <AskChatButton :label="asked.label" icon-only class="shrink-0" data-testid="spending-review-row-ask" @ask="ask" />
      <ReceiptCameraButton :label="asked.label" :available="takesReceipt" testid="spending-review-row-receipt" class="shrink-0" @take="emit('receipt', asked)" />
    </div>
    <div v-if="typedLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 text-sm text-muted" data-testid="spending-review-maybe-typed">{{ typedLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.join" data-testid="spending-review-join" @click="emit('join')" />
    </div>
    <div v-if="ruleCategory !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 text-sm text-muted" data-testid="spending-review-rule-says">{{ words.review.ruleSays(ruleCategory.name) }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.fileAsRule" data-testid="spending-review-file-as-rule" @click="emit('file', ruleCategory!)" />
    </div>
    <div v-if="transferLine !== null" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="min-w-0 flex-1 basis-48 text-sm text-muted" data-testid="spending-review-maybe-transfer">{{ transferLine }}</span>
      <UButton color="neutral" variant="outline" :label="words.review.pair" data-testid="spending-review-pair" @click="emit('pair')" />
    </div>
  </li>
</template>
