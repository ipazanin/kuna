<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import { typedSubsidy } from './subsidyTexts'
import type { SubsidyTexts } from './subsidyTexts'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import { useLoanWords } from './useLoanWords'

/** A fixed monthly amount a third party, such as APN, pays of each instalment it covers, and who that is. */
const texts = defineModel<SubsidyTexts>({ required: true })
const loanWords = useLoanWords()

const props = defineProps<{
  tried: boolean
  /** The loan's instalments, which the subsidy may not run past, or null while they are not typed. */
  loanInstalments: number | null
}>()

const errors = computed(() => typedSubsidy(texts.value, props.loanInstalments, loanWords.value.subsidyFields).errors)
</script>

<template>
  <UFormField :label="loanWords.subsidyFields.monthly" :error="(tried && errors.monthly) || false" :help="loanWords.subsidyFields.monthlyHelp">
    <MoneyInput v-model="texts.monthly" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="subsidy-monthly" />
  </UFormField>
  <UFormField :label="loanWords.subsidyFields.payer" :help="loanWords.subsidyFields.payerHelp">
    <UInput v-model="texts.payer" placeholder="APN" class="w-full" data-testid="subsidy-payer" />
  </UFormField>
  <UFormField :label="loanWords.subsidyFields.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="loanWords.subsidyFields.firstInstalmentHelp">
    <UInput v-model="texts.firstInstalment" inputmode="numeric" class="w-full" data-testid="subsidy-first-instalment" />
  </UFormField>
  <UFormField :label="loanWords.subsidyFields.instalments" :error="(tried && errors.instalments) || false" :help="loanWords.subsidyFields.instalmentsHelp">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="subsidy-instalments" />
  </UFormField>
</template>
