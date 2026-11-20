<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { mapLinkOf } from '../domain/photoPlace'
import { removeSplitOf } from '../../entries/application/entryWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Receipt } from '../../workbook/domain/receipt'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** Under a saved entry's receipt lines: where the receipt was photographed, when its photo held a position, and Remove the receipt. */
const props = defineProps<{
  entry: Transaction
  receipt: Receipt
}>()

const emit = defineEmits<{ removed: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const place = computed(() => {
  const link = mapLinkOf(props.receipt)
  return link === null ? null : { text: words.place(props.receipt.latitude, props.receipt.longitude), link }
})

/** Takes the receipt and its lines off, so the entry goes back to one part under the category most of its money was in. */
async function remove(): Promise<void> {
  const records = store.state.records
  if (records === null) return
  if (await writes.write(words.removed, (unit) => removeSplitOf(unit, records, props.entry), { key: 'remove-receipt', failedTitle: spendingWords.form.notSaved })) emit('removed')
}
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <p v-if="place !== null" class="flex flex-col items-start" data-testid="spending-entry-place">
      <span>{{ place.text }}</span>
      <a :href="place.link" target="_blank" rel="noopener noreferrer" class="quiet-link" data-testid="spending-entry-place-link">{{ words.openMap }}</a>
    </p>
    <UButton
      :label="words.remove"
      icon="i-lucide-receipt"
      color="neutral"
      variant="outline"
      :loading="writes.saving('remove-receipt')"
      :disabled="writes.busy.value || writes.refused.value"
      data-testid="spending-entry-remove-receipt"
      @click="remove"
    />
  </div>
</template>
