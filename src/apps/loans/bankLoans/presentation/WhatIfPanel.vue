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
import { plural } from '../../../../shared/text/translation'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { words } from './words'

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
  return plural(words.whatIf.months(count), count)
}

function apply(outcome: ExtraPaymentOutcome): void {
  if (typed.value !== null) emit('apply', { ...typed.value, effect: outcome.effect, editing: null })
}
</script>

<template>
  <AppCard :title="words.whatIf.title" :subtitle="words.whatIf.subtitle" data-testid="what-if">
    <div class="flex flex-col gap-4 px-4 pb-4 sm:px-5">
      <FormGrid>
        <UFormField :label="words.whatIf.amount">
          <UInput v-model="amount" inputmode="decimal" :placeholder="words.whatIf.amountPlaceholder" class="w-full" data-testid="what-if-amount" />
        </UFormField>
        <UFormField :label="words.whatIf.paidOn">
          <UInput v-model="date" type="date" class="w-full" data-testid="what-if-date" />
        </UFormField>
      </FormGrid>
      <UAlert
        v-if="result?.subsidyRepaidUntil"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="words.whatIf.subsidyTitle"
        :description="words.whatIf.subsidy(dayLabel(result.subsidyRepaidUntil))"
        data-testid="what-if-subsidy"
      />
      <div v-if="shorter && lower" class="grid gap-3 sm:grid-cols-2" data-testid="what-if-outcomes">
        <section class="flex flex-col gap-2 rounded-lg border border-default p-3" :aria-label="words.whatIf.shorter">
          <h3 class="text-sm font-medium text-highlighted">{{ words.whatIf.shorter }}</h3>
          <p class="text-xs text-muted">{{ words.whatIf.shorterNote }}</p>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-muted">{{ words.whatIf.paidOff }}</dt>
            <dd class="text-end">{{ shorter.payoff === null ? '–' : dayLabel(shorter.payoff) }}</dd>
            <dt class="text-muted">{{ words.whatIf.soonerBy }}</dt>
            <dd class="figure text-end">{{ months(shorter.monthsSaved) }}</dd>
            <dt class="text-muted">{{ words.whatIf.interestSaved }}</dt>
            <dd class="text-end"><MoneyText :cents="shorter.interestSaved" /></dd>
          </dl>
          <UButton :label="words.whatIf.apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" class="self-start" data-testid="what-if-apply-shorter" @click="apply(shorter)" />
        </section>
        <section class="flex flex-col gap-2 rounded-lg border border-default p-3" :aria-label="words.whatIf.lower">
          <h3 class="text-sm font-medium text-highlighted">{{ words.whatIf.lower }}</h3>
          <p class="text-xs text-muted">{{ words.whatIf.lowerNote }}</p>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt class="text-muted">{{ words.whatIf.newInstalment }}</dt>
            <dd class="text-end">
              <MoneyText v-if="lower.nextInstalment !== null" :cents="lower.nextInstalment" /><span v-else>{{ words.whatIf.paidOff }}</span>
            </dd>
            <dt class="text-muted">{{ words.whatIf.paidOff }}</dt>
            <dd class="text-end">{{ lower.payoff === null ? '–' : dayLabel(lower.payoff) }}</dd>
            <dt class="text-muted">{{ words.whatIf.interestSaved }}</dt>
            <dd class="text-end"><MoneyText :cents="lower.interestSaved" /></dd>
          </dl>
          <UButton :label="words.whatIf.apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" class="self-start" data-testid="what-if-apply-lower" @click="apply(lower)" />
        </section>
      </div>
      <p v-else class="text-sm text-muted">{{ words.whatIf.hint }}</p>
    </div>
  </AppCard>
</template>
