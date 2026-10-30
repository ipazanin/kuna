<script lang="ts">
import { typedRate } from '../domain/yearlyRate'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { words as loansWords } from '../../words'
import { words } from './words'

export interface RateTexts {
  rate: string
  rateType: RatePeriod['rateType']
  note: string
}

export function rateError(texts: RateTexts): string | null {
  return typedRate(texts.rate) === null ? words.rateFields.rateError : null
}
</script>

<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

/** The rate of a period, whether the bank can change it, and for a variable rate its index and margin. */
const texts = defineModel<RateTexts>({ required: true })

defineProps<{
  /** Whether to show the field's error, which waits for the first try to save. */
  tried: boolean
}>()

const RATE_TYPES = [
  { label: words.rateFields.fixed, value: 'fixed', description: words.rateFields.fixedHelp },
  { label: words.rateFields.variable, value: 'variable', description: words.rateFields.variableHelp },
]
</script>

<template>
  <UFormField :label="words.rateFields.rate" :error="(tried && rateError(texts)) || false" :help="words.rateFields.rateHelp">
    <UInput v-model="texts.rate" inputmode="decimal" :placeholder="words.rateFields.ratePlaceholder" class="w-full" data-testid="rate-field" />
  </UFormField>
  <URadioGroup v-model="texts.rateType" :items="RATE_TYPES" :legend="words.rateFields.type" orientation="vertical" data-testid="rate-type" />
  <UFormField :label="loansWords.form.note" :help="words.rateFields.noteHelp" class="sm:col-span-2">
    <UInput v-model="texts.note" class="w-full" />
  </UFormField>
</template>
