<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { entryAsked } from './entryAsked'
import ReceiptCameraButton from '../../receipts/presentation/ReceiptCameraButton.vue'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { LINK_INK } from '../../links/presentation/linkLine'
import type { LinkLine } from '../../links/presentation/linkLine'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'

/** One entry: a button that opens it, and the camera for its receipt beside it. The row tints as one unit while either button is hovered, unless it holds the highlight of the chat being about it. */
const props = defineProps<{
  row: EuroRow
  categories: readonly Category[]
  title: string
  colour: string
  details: string
  euros: string
  /** The record in another app the entry is linked to, or null. */
  link: LinkLine | null
  takesReceipt: boolean
}>()

const emit = defineEmits<{ open: [entry: Transaction]; receipt: [entry: AskedElement] }>()

const asked = computed(() => entryAsked(props.row.transaction, props.row.account))
const { marked } = useChatElement(asked, 'row')
</script>

<template>
  <li class="flex items-center border-t border-default transition-colors first:border-t-0 not-data-chat-tagged:has-[>button:hover]:bg-elevated/40" v-bind="marked">
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-start sm:px-5"
      data-testid="spending-row"
      :data-amount="row.transaction.amount"
      @click="emit('open', row.transaction)"
    >
      <span class="size-2.5 shrink-0 rounded-full" :style="{ background: colour }" aria-hidden="true" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="break-words text-sm text-highlighted">{{ title }}</span>
        <span v-if="details !== ''" class="break-words type-caption">{{ details }}</span>
        <span v-if="link !== null" class="flex items-start gap-1 type-caption" :class="LINK_INK[link.look]" data-testid="spending-row-link">
          <UIcon :name="link.icon" class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span class="break-words">{{ link.text }}</span>
        </span>
        <RowLines v-if="row.lines.length > 0" :lines="row.lines" :categories="categories" :currency="row.account.currency" />
      </span>
      <span class="flex shrink-0 flex-col items-end gap-0.5 type-body">
        <AccountMoneyText :cents="row.transaction.amount" :currency="row.account.currency" sign="always" tone="flow" />
        <span v-if="euros !== ''" class="figure type-caption">{{ euros }}</span>
      </span>
    </button>
    <ReceiptCameraButton :label="asked.label" :available="takesReceipt" testid="spending-row-receipt" class="me-2 shrink-0 sm:me-3" @take="emit('receipt', asked)" />
  </li>
</template>
