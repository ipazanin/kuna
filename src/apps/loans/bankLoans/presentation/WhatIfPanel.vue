<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { whatIfExtraPayment } from '../domain/whatIf'
import type { ExtraPaymentOutcome } from '../domain/whatIf'
import type { ExtraPaymentStart } from './ExtraPaymentDialog.vue'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { typedAmount } from '../../../../shared/money/typedAmount'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** An extra payment tried out against the plan, both ways the bank offers, without saving anything. */
const props = defineProps<{
  book: BankLoanBook
  /** Where the date starts: the next due date. */
  defaultDate: CivilDate
}>()

const emit = defineEmits<{
  /** Turn the tried payment into an extra payment, in its dialog. */
  apply: [start: ExtraPaymentStart]
}>()

const amount = ref('')
const date = ref<string>(props.defaultDate)

const typed = computed(() => {
  const cents = typedAmount(amount.value)
  const day = parseCivilDate(date.value)
  return cents !== null && cents > 0 && day !== null && day >= props.book.loan.drawdown ? { amount: cents, date: day } : null
})

const result = computed(() => {
  const tried = typed.value
  if (tried === null || props.book.plan === null) return null
  return whatIfExtraPayment(props.book.loan, props.book.ratePeriods, props.book.extraPayments, tried.date, tried.amount)
})

const shorter = computed(() => result.value?.outcomes.find((outcome) => outcome.effect === 'shorter-term') ?? null)
const lower = computed(() => result.value?.outcomes.find((outcome) => outcome.effect === 'lower-instalment') ?? null)

function months(count: number): string {
  return count === 1 ? '1 month' : `${count} months`
}

function apply(outcome: ExtraPaymentOutcome): void {
  if (typed.value !== null) emit('apply', { ...typed.value, effect: outcome.effect, editing: null })
}
</script>

<template>
  <AppCard title="What if I pay extra" subtitle="Try an amount and a date. Nothing is saved until you apply it." data-testid="what-if">
    <div class="flex flex-col gap-4 px-4 pb-4 sm:px-5">
      <FormGrid>
        <UFormField label="Extra amount">
          <UInput v-model="amount" inputmode="decimal" placeholder="10000.00" class="w-full" data-testid="what-if-amount" />
        </UFormField>
        <UFormField label="Paid on">
          <UInput v-model="date" type="date" class="w-full" data-testid="what-if-date" />
        </UFormField>
      </FormGrid>
      <UAlert
        v-if="result?.subsidyRepaidUntil"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        title="This means paying the subsidy back"
        :description="`The contract asks for the subsidy back when you repay early during it or in the two years after it ends, up to ${dayLabel(result.subsidyRepaidUntil)}.`"
        data-testid="what-if-subsidy"
      />
      <div v-if="shorter && lower" class="grid gap-3 sm:grid-cols-2" data-testid="what-if-outcomes">
        <section class="flex flex-col gap-2 rounded-lg border border-default p-3" aria-label="Shorter term">
          <h3 class="text-sm font-medium text-highlighted">Shorter term</h3>
          <p class="text-xs text-muted">The instalment stays the same.</p>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-muted">Paid off</dt>
            <dd class="text-end">{{ shorter.payoff === null ? '–' : dayLabel(shorter.payoff) }}</dd>
            <dt class="text-muted">Sooner by</dt>
            <dd class="figure text-end">{{ months(shorter.monthsSaved) }}</dd>
            <dt class="text-muted">Interest saved</dt>
            <dd class="text-end"><MoneyText :cents="shorter.interestSaved" /></dd>
          </dl>
          <UButton label="Apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" class="self-start" data-testid="what-if-apply-shorter" @click="apply(shorter)" />
        </section>
        <section class="flex flex-col gap-2 rounded-lg border border-default p-3" aria-label="Lower instalment">
          <h3 class="text-sm font-medium text-highlighted">Lower instalment</h3>
          <p class="text-xs text-muted">The loan ends when it would have.</p>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-muted">New instalment</dt>
            <dd class="text-end"><MoneyText v-if="lower.nextInstalment !== null" :cents="lower.nextInstalment" /><span v-else>Paid off</span></dd>
            <dt class="text-muted">Paid off</dt>
            <dd class="text-end">{{ lower.payoff === null ? '–' : dayLabel(lower.payoff) }}</dd>
            <dt class="text-muted">Interest saved</dt>
            <dd class="text-end"><MoneyText :cents="lower.interestSaved" /></dd>
          </dl>
          <UButton label="Apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" class="self-start" data-testid="what-if-apply-lower" @click="apply(lower)" />
        </section>
      </div>
      <p v-else class="text-sm text-muted">Type an amount above zero and a date on or after the payout to see both ways side by side.</p>
    </div>
  </AppCard>
</template>
