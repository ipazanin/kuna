<script setup lang="ts">
import LabelsAndEventFields from './LabelsAndEventFields.vue'
import type { LabelsAndEvents } from './useLabelsAndEvents'
import { words } from './words'
import CountsUnderField from '../../payees/presentation/CountsUnderField.vue'
import type { LineFiling } from '../../receipts/domain/receiptLines'
import ReceiptLineFiling from '../../receipts/presentation/ReceiptLineFiling.vue'
import type { Category } from '../../workbook/domain/category'
import { BY_DAYS } from '../../workbook/domain/event'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** The fields under one part of a split entry in the entry dialog: a receipt line's category and words, who the part counts under, and its labels and event. */
const filing = defineModel<LineFiling>('filing')
const payee = defineModel<string>('payee', { required: true })

defineProps<{
  line: TransactionItem
  /** How the line reads, which names its fields for a screen reader. */
  title: string
  entryPayee: string
  categories: readonly Category[]
  kit: LabelsAndEvents
  labelling: boolean
  /** Why Save cannot file the receipt line under its category, shown once saving was tried. */
  refusal: string | null
}>()
</script>

<template>
  <span class="flex min-w-0 flex-1 flex-col gap-1.5" data-testid="spending-entry-part-fields">
    <ReceiptLineFiling v-if="filing !== undefined" :model-value="filing" :categories="categories" :title="title" @update:model-value="filing = $event" />
    <NoteLine v-if="refusal !== null" tone="error" data-testid="spending-entry-line-refused">{{ refusal }}</NoteLine>
    <CountsUnderField v-model="payee" :entry-payee="entryPayee" :name="words.dialog.partCountsUnder(title)" compact />
    <LabelsAndEventFields
      v-if="labelling"
      compact
      :labels="kit.partLabels.value[line.id] ?? []"
      :event="kit.partEvents.value[line.id] ?? BY_DAYS"
      :kit="kit"
      :part="line.id"
      :filed-under="line.category"
      :labels-name="words.dialog.partLabels(title)"
      :event-name="words.dialog.partEvent(title)"
      testid="spending-entry-part"
      @update:labels="kit.labelPart(line.id, $event)"
      @update:event="kit.eventPart(line.id, $event)"
    />
  </span>
</template>
