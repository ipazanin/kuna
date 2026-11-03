<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import { computed } from 'vue'

import { useLoanWords } from './useLoanWords'
import { REPAYMENTS } from '../../workbook/domain/bankLoan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'

/** How a loan's instalments are set, annuity or equal principal, under its label. */
const repayment = defineModel<BankLoan['repayment']>({ required: true })

const loanWords = useLoanWords()
const options = computed(() => REPAYMENTS.map((value) => ({ value, label: loanWords.value.loanDialog.repayments[value] })))
</script>

<template>
  <UFormField :label="loanWords.loanDialog.repayment">
    <ChoiceButtons v-model="repayment" :options="options" :label="loanWords.loanDialog.repayment" />
  </UFormField>
</template>
