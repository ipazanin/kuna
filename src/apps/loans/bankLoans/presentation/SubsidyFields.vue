<script lang="ts">
import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from './typedCount'
import { words as loansWords } from '../../words'
import { words } from './words'

export interface SubsidyTexts {
  monthly: string
  payer: string
  firstInstalment: string
  instalments: string
}

export function subsidyTexts(subsidy: LoanSubsidy | null): SubsidyTexts {
  return subsidy === null
    ? { monthly: '', payer: '', firstInstalment: '1', instalments: '60' }
    : { monthly: amountForTyping(subsidy.monthly), payer: subsidy.payer, firstInstalment: String(subsidy.firstInstalment), instalments: String(subsidy.instalments) }
}

/** The subsidy the fields name, or why not, for a loan of this many instalments. */
export function typedSubsidy(
  texts: SubsidyTexts,
  instalments: number | null,
): { readonly subsidy: LoanSubsidy | null; readonly errors: Readonly<Record<Exclude<keyof SubsidyTexts, 'payer'>, string | null>> } {
  const monthly = typedAmount(texts.monthly)
  const firstInstalment = typedCount(texts.firstInstalment)
  const count = typedCount(texts.instalments)
  const pastTheEnd = firstInstalment !== null && count !== null && instalments !== null && firstInstalment + count - 1 > instalments
  const errors = {
    monthly: monthly === null || monthly <= 0 ? loansWords.form.anAmount : null,
    firstInstalment: firstInstalment === null ? words.subsidyFields.firstInstalmentError : null,
    instalments: count === null ? words.subsidyFields.instalmentsError : pastTheEnd && instalments !== null ? words.subsidyFields.pastTheEnd(instalments) : null,
  }
  const subsidy = monthly !== null && monthly > 0 && firstInstalment !== null && count !== null && !pastTheEnd ? { monthly, firstInstalment, instalments: count, payer: texts.payer.trim() } : null
  return { subsidy, errors }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

/** A fixed monthly amount a third party, such as APN, pays of each instalment it covers, and who that is. */
const texts = defineModel<SubsidyTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  /** The loan's instalments, which the subsidy may not run past, or null while they are not typed. */
  loanInstalments: number | null
}>()

const errors = computed(() => typedSubsidy(texts.value, props.loanInstalments).errors)
</script>

<template>
  <UFormField :label="words.subsidyFields.monthly" :error="(tried && errors.monthly) || false" :help="words.subsidyFields.monthlyHelp">
    <UInput v-model="texts.monthly" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="subsidy-monthly" />
  </UFormField>
  <UFormField :label="words.subsidyFields.payer" :help="words.subsidyFields.payerHelp">
    <UInput v-model="texts.payer" placeholder="APN" class="w-full" data-testid="subsidy-payer" />
  </UFormField>
  <UFormField :label="words.subsidyFields.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="words.subsidyFields.firstInstalmentHelp">
    <UInput v-model="texts.firstInstalment" inputmode="numeric" class="w-full" data-testid="subsidy-first-instalment" />
  </UFormField>
  <UFormField :label="words.subsidyFields.instalments" :error="(tried && errors.instalments) || false" :help="words.subsidyFields.instalmentsHelp">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="subsidy-instalments" />
  </UFormField>
</template>
