<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import InstrumentDialog from '../../holdings/presentation/InstrumentDialog.vue'
import { listingLine } from '../../holdings/presentation/holdingText'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'

/** One of the file's instruments by its id, found by name, symbol or ISIN, or a new one added on the spot. */
const instrument = defineModel<string>({ required: true })

const props = defineProps<{
  label: string
  error: string | false
  book: InvestmentBook
  /** Whether no holding is a choice too, as for interest. */
  optional?: boolean
  testId: string
}>()

const adding = ref(false)
const items = computed(() => [
  ...(props.optional ? [{ label: words.fields.noHolding, value: '', description: '', isin: '' }] : []),
  ...props.book.instruments.map((candidate) => ({ label: candidate.name, value: candidate.id, description: listingLine(candidate), isin: candidate.isin ?? '' })),
])
</script>

<template>
  <UFormField :label="label" :help="words.fields.holdingHelp" :error="error" class="sm:col-span-2">
    <div class="flex items-center gap-2">
      <USelectMenu
        v-model="instrument"
        :items="items"
        value-key="value"
        :filter-fields="['label', 'description', 'isin']"
        :search-input="{ placeholder: words.fields.holdingSearch }"
        class="min-w-0 flex-1"
        :data-testid="testId"
      />
      <UButton :label="words.fields.newHolding" icon="i-lucide-plus" color="neutral" variant="outline" class="shrink-0" :data-testid="`${testId}-new`" @click="adding = true" />
    </div>
    <InstrumentDialog v-model:open="adding" :instrument="null" :book="book" @saved="instrument = $event.id" />
  </UFormField>
</template>
