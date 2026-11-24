<script setup lang="ts">
import { computed } from 'vue'

import { entryAsked } from './entryAsked'
import { words } from './words'
import ReceiptCameraButton from '../../receipts/presentation/ReceiptCameraButton.vue'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { rowTone } from '../../categories/presentation/amountTone'
import { LINK_TONE } from '../../links/presentation/linkLine'
import type { LinkLine } from '../../links/presentation/linkLine'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { Category } from '../../workbook/domain/category'
import { hasParts, holdsReceipt } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import PickBox from '../../../../shared/ui/PickBox.vue'

/** One entry: a button that opens it, or ticks it while rows are being selected, and beside it the camera for its receipt, or a mark that a receipt is attached. The row tints as one unit while either button is hovered, unless it holds the highlight of the chat being about it. */
const props = defineProps<{
  row: EuroRow
  categories: readonly Category[]
  title: string
  colour: string
  details: string
  euros: string
  /** The record in another app the entry is linked to, or null. */
  link: LinkLine | null
  /** The names of its labels, or blank. */
  labels: string
  /** Whether it is picked while rows are being selected, or null while a tap opens it. */
  picked: boolean | null
  takesReceipt: boolean
  /** Whether a row of the list holds a receipt, so every row keeps the box its mark sits in. */
  receiptBoxes: boolean
  /** The names of the shared costs its parts may be in, by their ids. */
  homes: ReadonlyMap<RecordId, string>
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
      v-bind="picked === null ? {} : { role: 'checkbox', 'aria-checked': picked }"
      @click="emit('open', row.transaction)"
    >
      <PickBox v-if="picked !== null" :picked="picked" />
      <span class="size-2.5 shrink-0 rounded-full" :style="{ background: colour }" aria-hidden="true" />
      <span class="entry-row-line flex min-w-0 flex-1 items-center gap-3">
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="break-words type-row-title" data-entry-title>{{ title }}</span>
          <span v-if="details !== ''" class="break-words type-caption">{{ details }}</span>
          <NoteLine v-if="row.transaction.pending" as="span" tone="muted" icon="i-lucide-clock" data-testid="spending-row-pending">{{ words.notBookedYet }}</NoteLine>
          <NoteLine v-if="link !== null" as="span" :tone="LINK_TONE[link.look]" :icon="link.icon" data-testid="spending-row-link">{{ link.text }}</NoteLine>
          <NoteLine v-if="labels !== ''" as="span" tone="muted" icon="i-lucide-tag" data-testid="spending-row-labels">{{ labels }}</NoteLine>
          <RowLines v-if="hasParts(row.items)" :lines="row.items" :categories="categories" :currency="row.account.currency" :homes="homes" />
        </span>
        <span data-entry-amount class="flex shrink-0 flex-col items-end gap-0.5 type-body">
          <AccountMoneyText :cents="row.transaction.amount" :currency="row.account.currency" :tone="rowTone(row.items, categories)" />
          <span v-if="euros !== ''" class="figure type-caption">{{ euros }}</span>
        </span>
      </span>
    </button>
    <ReceiptCameraButton
      v-if="picked === null"
      :label="asked.label"
      :available="takesReceipt"
      :held="holdsReceipt(row.items)"
      :boxed="receiptBoxes"
      testid="spending-row-receipt"
      class="me-2 shrink-0 sm:me-3"
      @take="emit('receipt', asked)"
    />
  </li>
</template>
