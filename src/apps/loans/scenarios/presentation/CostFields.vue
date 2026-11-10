<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import { costErrors, words } from './words'
import { typedCosts } from '../domain/changeTexts'
import type { CostTexts } from '../domain/changeTexts'
import { words as loansWords } from '../../words'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** What a loan charges beside its instalments: once, each month and each year. */
const texts = defineModel<CostTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  /** What the fields' test ids start with. */
  testPrefix: string
}>()

const errors = computed(() => costErrors(typedCosts(texts.value).faults))
const shown = (error: string | null): string | false => (props.tried && error) || false
</script>

<template>
  <UFormField :label="words.editor.upfront" :error="shown(errors.upfront)" :help="words.editor.costsHelp">
    <MoneyInput v-model="texts.upfront" :placeholder="loansWords.form.amountPlaceholder" class="w-full" :data-testid="`${testPrefix}-upfront`" />
  </UFormField>
  <UFormField :label="words.editor.monthly" :error="shown(errors.monthly)">
    <MoneyInput v-model="texts.monthly" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
  <UFormField :label="words.editor.yearly" :error="shown(errors.yearly)">
    <MoneyInput v-model="texts.yearly" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
</template>
