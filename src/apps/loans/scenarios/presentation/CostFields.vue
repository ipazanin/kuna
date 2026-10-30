<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { typedCosts } from './changeTexts'
import type { CostTexts } from './changeTexts'
import { words } from './words'
import { words as loansWords } from '../../words'

/** What a loan charges beside its instalments: once, each month and each year. */
const texts = defineModel<CostTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  /** What the fields' test ids start with. */
  testPrefix: string
}>()

const errors = computed(() => typedCosts(texts.value).errors)
const shown = (error: string | null): string | false => (props.tried && error) || false
</script>

<template>
  <UFormField :label="words.editor.upfront" :error="shown(errors.upfront)" :help="words.editor.costsHelp">
    <UInput v-model="texts.upfront" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" :data-testid="`${testPrefix}-upfront`" />
  </UFormField>
  <UFormField :label="words.editor.monthly" :error="shown(errors.monthly)">
    <UInput v-model="texts.monthly" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
  <UFormField :label="words.editor.yearly" :error="shown(errors.yearly)">
    <UInput v-model="texts.yearly" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
</template>
