<script lang="ts">
import type { YearlyRate } from '../domain/yearlyRate'
import { rateOfText } from '../domain/yearlyRate'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'

export interface RateTexts {
  rate: string
  rateType: RatePeriod['rateType']
  note: string
}

/** The rate typed with a dot or a comma, or null when it is not a percent with at most four decimals. */
export function typedRate(text: string): YearlyRate | null {
  return rateOfText(text.replace(',', '.'))
}

export function rateError(texts: RateTexts): string | null {
  return typedRate(texts.rate) === null ? 'A yearly rate such as 2.99, with at most four decimals' : null
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
  { label: 'Fixed', value: 'fixed', description: 'The bank keeps it for the period.' },
  { label: 'Variable', value: 'variable', description: 'It follows an index, so the plan is an estimate.' },
]
</script>

<template>
  <UFormField label="Yearly rate, %" :error="(tried && rateError(texts)) || false" help="The rate the bank applies, such as 2.99.">
    <UInput v-model="texts.rate" inputmode="decimal" placeholder="2.99" class="w-full" data-testid="rate-field" />
  </UFormField>
  <URadioGroup v-model="texts.rateType" :items="RATE_TYPES" legend="Rate" orientation="vertical" data-testid="rate-type" />
  <UFormField label="Note" help="For a variable rate, the index and margin, such as 3M EURIBOR + 0.67." class="sm:col-span-2">
    <UInput v-model="texts.note" class="w-full" />
  </UFormField>
</template>
