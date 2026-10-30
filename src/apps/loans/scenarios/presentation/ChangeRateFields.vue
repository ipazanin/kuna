<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import type { RateTexts } from './changeTexts'
import { words } from './words'
import { MILLIONTHS_PER_PERCENT, rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import type { YearlyRate } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import { plural } from '../../../../shared/text/translation'

/** A yearly rate and whether the bank can change it, with quick fills a point or two over the rate in force. */
const texts = defineModel<RateTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  /** The rate in force where the change starts, which the quick fills add to, or null for none. */
  current: YearlyRate | null
  /** What the fields' test ids start with. */
  testPrefix: string
}>()

const RATE_TYPES = [
  { label: bankWords.rateFields.fixed, value: 'fixed', description: bankWords.rateFields.fixedHelp },
  { label: bankWords.rateFields.variable, value: 'variable', description: bankWords.rateFields.variableHelp },
]

const error = computed(() => (props.tried && typedRate(texts.value.rate) === null ? bankWords.rateFields.rateError : false))

function plus(points: number): void {
  if (props.current !== null) texts.value.rate = rateText((props.current + points * MILLIONTHS_PER_PERCENT) as YearlyRate)
}
</script>

<template>
  <UFormField class="sm:col-span-2" :label="words.editor.rate" :error="error" :help="current === null ? bankWords.rateFields.rateHelp : words.editor.rateHint">
    <UInput v-model="texts.rate" inputmode="decimal" :placeholder="bankWords.rateFields.ratePlaceholder" class="w-full" :data-testid="`${testPrefix}-rate`" />
    <div v-if="current !== null" class="mt-2 flex flex-wrap gap-1.5">
      <UButton v-for="points in [1, 2]" :key="points" :label="plural(words.editor.plusPoints(points), points)" color="neutral" variant="outline" size="xs" @click="plus(points)" />
    </div>
  </UFormField>
  <URadioGroup v-model="texts.rateType" :items="RATE_TYPES" :legend="words.editor.rateType" orientation="vertical" class="sm:col-span-2" />
</template>
