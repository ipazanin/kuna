<script lang="ts">
import type { LoanSubsidy } from '../../workbook/domain/bankLoan'
import { amountOf } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from './typedCount'

export interface SubsidyTexts {
  monthly: string
  firstInstalment: string
  instalments: string
}

export function subsidyTexts(subsidy: LoanSubsidy | null): SubsidyTexts {
  return subsidy === null
    ? { monthly: '', firstInstalment: '1', instalments: '60' }
    : { monthly: amountOf(subsidy.monthly).toFixed(2), firstInstalment: String(subsidy.firstInstalment), instalments: String(subsidy.instalments) }
}

/** The subsidy the fields name, or why not, for a loan of this many instalments. */
export function typedSubsidy(texts: SubsidyTexts, instalments: number | null): { readonly subsidy: LoanSubsidy | null; readonly errors: Readonly<Record<keyof SubsidyTexts, string | null>> } {
  const monthly = typedAmount(texts.monthly)
  const firstInstalment = typedCount(texts.firstInstalment)
  const count = typedCount(texts.instalments)
  const pastTheEnd = firstInstalment !== null && count !== null && instalments !== null && firstInstalment + count - 1 > instalments
  const errors = {
    monthly: monthly === null || monthly <= 0 ? 'An amount above zero with at most two decimals' : null,
    firstInstalment: firstInstalment === null ? 'The number of the first instalment it covers, such as 1' : null,
    instalments: count === null ? 'A whole number above zero' : pastTheEnd ? `It runs past instalment ${instalments}, the loan's last` : null,
  }
  const subsidy = monthly !== null && monthly > 0 && firstInstalment !== null && count !== null && !pastTheEnd ? { monthly, firstInstalment, instalments: count } : null
  return { subsidy, errors }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

/** A fixed monthly amount a third party, such as APN, pays of each instalment it covers. */
const texts = defineModel<SubsidyTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  /** The loan's instalments, which the subsidy may not run past, or null while they are not typed. */
  loanInstalments: number | null
}>()

const errors = computed(() => typedSubsidy(texts.value, props.loanInstalments).errors)
</script>

<template>
  <UFormField label="Subsidy each month" :error="(tried && errors.monthly) || false" help="What the subsidy pays of each covered instalment." class="sm:col-span-2">
    <UInput v-model="texts.monthly" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="subsidy-monthly" />
  </UFormField>
  <UFormField label="First covered instalment" :error="(tried && errors.firstInstalment) || false" help="Counting from 1.">
    <UInput v-model="texts.firstInstalment" inputmode="numeric" class="w-full" />
  </UFormField>
  <UFormField label="Instalments covered" :error="(tried && errors.instalments) || false" help="A child born during the subsidy adds 24.">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" />
  </UFormField>
</template>
