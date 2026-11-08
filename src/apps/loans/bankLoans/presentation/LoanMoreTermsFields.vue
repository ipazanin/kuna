<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import { typedLoanTerms } from './loanTermsTexts'
import type { LoanTermsTexts } from './loanTermsTexts'
import { useLoanWords } from './useLoanWords'

/** The terms a first figure can do without: the lender and the interest charged before the first instalment. */
const texts = defineModel<LoanTermsTexts>({ required: true })
const loanWords = useLoanWords()

defineProps<{
  /** Whether to show the fields' errors, which wait for the first try to save. */
  tried: boolean
}>()

const errors = computed(() => typedLoanTerms(texts.value).errors)
</script>

<template>
  <UFormField :label="loanWords.loanDialog.lender" class="sm:col-span-2">
    <UInput v-model="texts.lender" :placeholder="loanWords.loanDialog.lenderPlaceholder" class="w-full" data-testid="bank-loan-lender" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.interim" :error="(tried && errors.interim) || false" :help="loanWords.loanDialog.interimHelp">
    <MoneyInput v-model="texts.interimAmount" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.interimDate">
    <UInput v-model="texts.interimDate" type="date" class="w-full" />
  </UFormField>
</template>
