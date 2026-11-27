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
import ListRow from '../../../../shared/ui/ListRow.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** One entry: a row that opens it, or ticks it while rows are being selected, and at its end the camera for its receipt, or a mark that a receipt is attached. */
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

const emit = defineEmits<{ open: [entry: Transaction]; pick: [entry: Transaction]; receipt: [entry: AskedElement] }>()

const asked = computed(() => entryAsked(props.row.transaction, props.row.account))
const { marked } = useChatElement(asked, 'row')
</script>

<template>
  <ListRow
    :title="title"
    :caption="details"
    :picked="picked"
    opens
    v-bind="marked"
    data-testid="spending-row"
    :data-amount="row.transaction.amount"
    @open="emit('open', row.transaction)"
    @pick="emit('pick', row.transaction)"
  >
    <template #lead><span class="size-2.5 rounded-full" :style="{ background: colour }" /></template>
    <template #amount>
      <AccountMoneyText :cents="row.transaction.amount" :currency="row.account.currency" :tone="rowTone(row.items, categories)" />
      <span v-if="euros !== ''" class="figure type-caption">{{ euros }}</span>
    </template>
    <template v-if="row.transaction.pending || link !== null || labels !== '' || hasParts(row.items)" #details>
      <NoteLine v-if="row.transaction.pending" as="span" tone="muted" icon="i-lucide-clock" data-testid="spending-row-pending">{{ words.notBookedYet }}</NoteLine>
      <NoteLine v-if="link !== null" as="span" :tone="LINK_TONE[link.look]" :icon="link.icon" data-testid="spending-row-link">{{ link.text }}</NoteLine>
      <NoteLine v-if="labels !== ''" as="span" tone="muted" icon="i-lucide-tag" data-testid="spending-row-labels">{{ labels }}</NoteLine>
      <RowLines v-if="hasParts(row.items)" :lines="row.items" :categories="categories" :currency="row.account.currency" :homes="homes" />
    </template>
    <template #trailing>
      <ReceiptCameraButton :label="asked.label" :available="takesReceipt" :held="holdsReceipt(row.items)" :boxed="receiptBoxes" testid="spending-row-receipt" @take="emit('receipt', asked)" />
    </template>
  </ListRow>
</template>
