<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { comingDues, instalmentsLeftFrom, triedRate, whatIfChange, whatIfExtraPayment } from '../domain/whatIf'
import type { ExtraPaymentOutcome, TriedChange } from '../domain/whatIf'
import { typedRate } from '../domain/yearlyRate'
import type { ExtraPaymentStart } from './ExtraPaymentDialog.vue'
import TryOutcome from './TryOutcome.vue'
import { tryName } from './savedTries'
import { typedTerm } from '../domain/typedTerm'
import { useLoanWords } from './useLoanWords'
import { newLoanScenario, saveScenario } from '../../scenarios/application/scenarioWrites'
import { spanOf } from '../../scenarios/presentation/scenarioComparison'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { words as loansWords } from '../../words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/**
 * A change tried out against the plan without saving anything: an extra payment both ways the bank
 * offers, a new rate from a due date, or a new term from a due date. Each try can be saved as it
 * is, and an extra payment applied.
 */
const props = defineProps<{
  book: BankLoanBook
  /** Where the dates start: the next due date. */
  defaultDate: CivilDate
  today: CivilDate
}>()
const loanWords = useLoanWords()

const emit = defineEmits<{
  /** Turn the tried payment into an extra payment, in its dialog. */
  apply: [start: ExtraPaymentStart]
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)

type TryKind = 'extra' | 'rate' | 'term'
const kind = ref<TryKind>('extra')
const kindOptions = computed(() => (['extra', 'rate', 'term'] as const).map((value) => ({ value, label: loanWords.value.whatIf.kinds[value] })))

const amount = ref('')
const date = ref<string>(props.defaultDate)

const typed = computed(() => {
  const cents = typedAmount(amount.value)
  const day = parseCivilDate(date.value)
  return cents !== null && cents > 0 && day !== null && day >= props.book.loan.drawdown ? { amount: cents, date: day } : null
})

const result = computed(() => {
  const tried = typed.value
  return tried === null ? null : whatIfExtraPayment(props.book, tried.date, tried.amount)
})

const shorter = computed(() => result.value?.outcomes.find((outcome) => outcome.effect === 'shorter-term') ?? null)
const lower = computed(() => result.value?.outcomes.find((outcome) => outcome.effect === 'lower-instalment') ?? null)

const coming = computed(() => comingDues(props.book, props.today))
const dueItems = computed(() => coming.value.map((row) => ({ label: loanWords.value.ratePeriodDialog.dueDate(dayLabel(row.date), row.number ?? 0), value: row.date })))
const due = ref<CivilDate>(props.defaultDate)
const rate = ref('')
const years = ref('')
const months = ref('')

const leftThen = computed(() => instalmentsLeftFrom(props.book, props.today, due.value))
const termInstalments = computed(() => {
  const count = typedTerm(years.value, months.value)
  return count !== null && count < leftThen.value ? count : null
})
const termError = computed(() => (years.value.trim() !== '' || months.value.trim() !== '') && termInstalments.value === null)

const triedChange = computed((): TriedChange | null => {
  const from = coming.value.some((row) => row.date === due.value) ? due.value : null
  if (from === null) return null
  if (kind.value === 'rate') {
    const typedRateValue = typedRate(rate.value)
    return typedRateValue === null ? null : triedRate(props.book, from, typedRateValue)
  }
  return termInstalments.value === null ? null : { kind: 'term-change', from, instalments: termInstalments.value }
})
const tried = computed(() => (triedChange.value === null ? null : whatIfChange(props.book, triedChange.value)))

function monthsText(count: number): string {
  return plural(loanWords.value.whatIf.months(count), count)
}

const payoffFact = (payoff: CivilDate | null): Fact => ({ label: loanWords.value.whatIf.paidOff, value: payoff === null ? '–' : dayLabel(payoff) })
const instalmentFact = (instalment: Money | null): Fact => ({ label: loanWords.value.whatIf.newInstalment, value: instalment === null ? loanWords.value.whatIf.paidOff : formatMoney(instalment) })
const soonerFact = (months: number): Fact => ({ label: loanWords.value.whatIf.soonerBy, value: monthsText(months) })
/** Interest saved, or the interest added where a try costs more. */
const interestFact = (saved: Money): Fact =>
  saved < 0 ? { label: loanWords.value.whatIf.moreInterest, value: formatMoney(negateMoney(saved)) } : { label: loanWords.value.whatIf.interestSaved, value: formatMoney(saved) }

const shorterFacts = computed((): Fact[] => (shorter.value === null ? [] : [payoffFact(shorter.value.payoff), soonerFact(shorter.value.monthsSaved), interestFact(shorter.value.interestSaved)]))
const lowerFacts = computed((): Fact[] => (lower.value === null ? [] : [instalmentFact(lower.value.nextInstalment), payoffFact(lower.value.payoff), interestFact(lower.value.interestSaved)]))
const triedFacts = computed((): Fact[] => {
  const outcome = tried.value
  if (outcome === null) return []
  return [instalmentFact(outcome.nextInstalment), payoffFact(outcome.payoff), ...(kind.value === 'term' ? [soonerFact(outcome.monthsSaved)] : []), interestFact(outcome.interestSaved)]
})

function apply(outcome: ExtraPaymentOutcome): void {
  if (typed.value !== null) emit('apply', { ...typed.value, effect: outcome.effect, editing: null })
}

async function saveTry(change: TriedChange, key: string): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const name = tryName(change, loanWords.value)
  const scenario = newLoanScenario({ name, start: { kind: 'loan', loan: props.book.loan.id } })
  await writes.write(loanWords.value.savedTries.saved, (unit) => saveScenario(unit, records, scenario, [change], null), {
    description: loanWords.value.savedTries.named(name),
    failedTitle: loansWords.form.notSaved,
    key,
  })
}

function saveExtra(outcome: ExtraPaymentOutcome): void {
  const payment = typed.value
  if (payment === null) return
  void saveTry({ kind: 'extra-payment', date: payment.date, amount: payment.amount, effect: outcome.effect }, `try-${outcome.effect}`)
}

function saveTried(): void {
  const change = triedChange.value
  if (change !== null) void saveTry(change, 'try')
}
</script>

<template>
  <AppCard :title="loanWords.whatIf.title" :subtitle="loanWords.whatIf.subtitle" data-testid="what-if">
    <div class="flex flex-col gap-4 px-4 pb-4 sm:px-5">
      <ChoiceButtons v-model="kind" :options="kindOptions" :label="loanWords.whatIf.kind" data-testid="what-if-kind" />
      <template v-if="kind === 'extra'">
        <FormGrid>
          <UFormField :label="loanWords.whatIf.amount">
            <MoneyInput v-model="amount" :placeholder="loanWords.whatIf.amountPlaceholder" class="w-full" data-testid="what-if-amount" />
          </UFormField>
          <UFormField :label="loanWords.whatIf.paidOn">
            <UInput v-model="date" type="date" class="w-full" data-testid="what-if-date" />
          </UFormField>
        </FormGrid>
        <UAlert
          v-if="result?.subsidyRepaidUntil"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="loanWords.whatIf.subsidyTitle"
          :description="loanWords.whatIf.subsidy(dayLabel(result.subsidyRepaidUntil))"
          data-testid="what-if-subsidy"
        />
        <div v-if="shorter && lower" class="grid gap-3 sm:grid-cols-2" data-testid="what-if-outcomes">
          <TryOutcome :title="loanWords.whatIf.shorter" :note="loanWords.whatIf.shorterNote" :facts="shorterFacts">
            <template #actions>
              <div class="flex flex-wrap gap-1.5">
                <UButton :label="loanWords.whatIf.apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" data-testid="what-if-apply-shorter" @click="apply(shorter)" />
                <UButton
                  :label="loanWords.whatIf.save"
                  icon="i-lucide-bookmark-plus"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :loading="writes.saving('try-shorter-term')"
                  data-testid="what-if-save-shorter"
                  @click="saveExtra(shorter)"
                />
              </div>
            </template>
          </TryOutcome>
          <TryOutcome :title="loanWords.whatIf.lower" :note="loanWords.whatIf.lowerNote" :facts="lowerFacts">
            <template #actions>
              <div class="flex flex-wrap gap-1.5">
                <UButton :label="loanWords.whatIf.apply" icon="i-lucide-check" color="neutral" variant="outline" size="sm" data-testid="what-if-apply-lower" @click="apply(lower)" />
                <UButton
                  :label="loanWords.whatIf.save"
                  icon="i-lucide-bookmark-plus"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :loading="writes.saving('try-lower-instalment')"
                  data-testid="what-if-save-lower"
                  @click="saveExtra(lower)"
                />
              </div>
            </template>
          </TryOutcome>
        </div>
        <p v-else class="type-body">{{ loanWords.whatIf.hint }}</p>
      </template>
      <template v-else>
        <FormGrid>
          <UFormField :label="loanWords.ratePeriodDialog.from" :class="{ 'sm:col-span-2': kind === 'term' }">
            <USelectMenu
              v-model="due"
              :items="dueItems"
              value-key="value"
              :placeholder="loanWords.ratePeriodDialog.choose"
              :search-input="{ placeholder: loanWords.ratePeriodDialog.search }"
              class="w-full"
              data-testid="what-if-due"
            />
          </UFormField>
          <UFormField v-if="kind === 'rate'" :label="loanWords.rateFields.rate" :help="loanWords.rateFields.rateHelp">
            <UInput v-model="rate" inputmode="decimal" :placeholder="loanWords.rateFields.ratePlaceholder" class="w-full" data-testid="what-if-rate" />
          </UFormField>
          <template v-else>
            <UFormField :label="loanWords.whatIf.yearsLeft" :error="termError ? loanWords.whatIf.termError : false" :help="loanWords.whatIf.leftThen(spanOf(leftThen))">
              <UInput v-model="years" inputmode="numeric" class="w-full" data-testid="what-if-years" />
            </UFormField>
            <UFormField :label="loanWords.whatIf.monthsLeft">
              <UInput v-model="months" inputmode="numeric" class="w-full" data-testid="what-if-months" />
            </UFormField>
          </template>
        </FormGrid>
        <TryOutcome v-if="tried" :label="loanWords.whatIf.kinds[kind]" :facts="triedFacts" data-testid="what-if-tried">
          <template #actions>
            <UButton
              :label="loanWords.whatIf.save"
              icon="i-lucide-bookmark-plus"
              color="neutral"
              variant="outline"
              size="sm"
              class="self-start"
              :loading="writes.saving('try')"
              data-testid="what-if-save"
              @click="saveTried"
            />
          </template>
        </TryOutcome>
        <p v-else class="type-body">{{ kind === 'rate' ? loanWords.whatIf.rateHint : loanWords.whatIf.termHint }}</p>
      </template>
    </div>
  </AppCard>
</template>
