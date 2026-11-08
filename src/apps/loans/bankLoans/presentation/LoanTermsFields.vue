<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import { typedLoanTerms } from './loanTermsTexts'
import type { LoanTermsTexts } from './loanTermsTexts'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import RepaymentChoice from './RepaymentChoice.vue'
import { useLoanWords } from './useLoanWords'

/** What a bank loan's plan cannot do without: the amount, how it is repaid, the instalments and the two days. */
const texts = defineModel<LoanTermsTexts>({ required: true })
const loanWords = useLoanWords()

defineProps<{
  /** Whether to show the fields' errors, which wait for the first try to save. */
  tried: boolean
}>()

const errors = computed(() => typedLoanTerms(texts.value).errors)
</script>

<template>
  <UFormField :label="loanWords.loanDialog.principal" :error="(tried && errors.principal) || false" :help="loanWords.loanDialog.principalHelp">
    <MoneyInput v-model="texts.principal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="bank-loan-principal" />
  </UFormField>
  <RepaymentChoice v-model="texts.repayment" class="sm:col-span-2" data-testid="bank-loan-repayment" />
  <UFormField :label="loanWords.loanDialog.instalments" :error="(tried && errors.instalments) || false" :help="loanWords.loanDialog.instalmentsHelp">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="bank-loan-instalments" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.drawdown" :error="(tried && errors.drawdown) || false" :help="loanWords.loanDialog.drawdownHelp">
    <UInput v-model="texts.drawdown" type="date" class="w-full" data-testid="bank-loan-drawdown" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="loanWords.loanDialog.firstInstalmentHelp">
    <UInput v-model="texts.firstInstalment" type="date" class="w-full" data-testid="bank-loan-first-instalment" />
  </UFormField>
</template>
