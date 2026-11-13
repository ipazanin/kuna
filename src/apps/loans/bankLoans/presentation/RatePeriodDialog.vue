<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { RATE_PERIOD_WRITES, newRatePeriod } from '../application/bankLoanWrites'
import { dueDateOf } from '../domain/loanPlan'
import { rateText, typedRate } from '../domain/yearlyRate'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import RateFields, { rateError } from './RateFields.vue'
import type { RateTexts } from './RateFields.vue'
import { words as loansWords } from '../../words'
import { useLoanWords } from './useLoanWords'

/** A rate the loan pays from one of its due dates on. The first period always starts at the first instalment. */
const open = defineModel<boolean>('open', { required: true })
const loanWords = useLoanWords()

const props = defineProps<{
  book: BankLoanBook
  /** The period to change, or null to add one. */
  editing: RatePeriod | null
}>()

const writes = useRecordWrites(useLoansBooks())

const from = ref('')
const rate = ref<RateTexts>({ rate: '', rateType: 'variable', note: '' })
const tried = ref(false)

const isFirst = computed(() => props.editing?.from === props.book.loan.firstInstalment)

/** The due dates a new rate can start on: every instalment after the first that no other period starts on. */
const dueItems = computed(() => {
  const { loan } = props.book
  const taken = new Set(props.book.ratePeriods.filter((period) => period.id !== props.editing?.id).map((period) => period.from))
  return Array.from({ length: loan.instalments }, (_, offset) => ({ number: offset + 1, date: dueDateOf(loan, offset + 1) }))
    .filter(({ number, date }) => (isFirst.value ? number === 1 : number > 1) && !taken.has(date))
    .map(({ number, date }): { label: string; value: string } => ({ label: loanWords.value.ratePeriodDialog.dueDate(dayLabel(date), number), value: date }))
})

watch(open, (opened) => {
  if (!opened) return
  const period = props.editing
  from.value = period?.from ?? ''
  rate.value = period === null ? { rate: '', rateType: 'variable', note: '' } : { rate: rateText(period.rate), rateType: period.rateType, note: period.note }
  tried.value = false
})

const errors = computed(() => ({
  from: dueItems.value.some((item) => item.value === from.value) ? null : loanWords.value.ratePeriodDialog.fromError,
  rate: rateError(rate.value),
}))

async function save(): Promise<void> {
  tried.value = true
  const yearly = typedRate(rate.value.rate)
  const day = parseCivilDate(from.value)
  if (errors.value.from !== null || yearly === null || day === null) return
  const typed = newRatePeriod({ loan: props.book.loan.id, from: day, rate: yearly, rateType: rate.value.rateType, note: rate.value.note })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(loanWords.value.ratePeriodDialog.added, (unit) => unit.of(RATE_PERIOD_WRITES).add(typed), { failedTitle: loansWords.form.notAdded })
      : await writes.write(loanWords.value.ratePeriodDialog.saved, (unit) => unit.of(RATE_PERIOD_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: loansWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(loanWords.value.ratePeriodDialog.deleted, (unit) => unit.of(RATE_PERIOD_WRITES).remove(before), { key: 'delete', failedTitle: loansWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="editing === null ? loanWords.ratePeriodDialog.addTitle : loanWords.ratePeriodDialog.changeTitle" :description="loanWords.ratePeriodDialog.description">
    <FormGrid id="rate-period" as="form" data-testid="rate-period-form" @submit.prevent="save">
      <UFormField
        :label="loanWords.ratePeriodDialog.from"
        :error="(tried && errors.from) || false"
        :help="isFirst ? loanWords.ratePeriodDialog.firstHelp : loanWords.ratePeriodDialog.laterHelp"
        class="sm:col-span-2"
      >
        <USelectMenu
          v-model="from"
          :items="dueItems"
          value-key="value"
          :disabled="isFirst"
          :placeholder="loanWords.ratePeriodDialog.choose"
          :search-input="{ placeholder: loanWords.ratePeriodDialog.search }"
          class="w-full"
          data-testid="rate-period-from"
        />
      </UFormField>
      <RateFields v-model="rate" :tried="tried" />
      <UFormField :label="loansWords.form.note" :help="loanWords.rateFields.noteHelp" class="sm:col-span-2">
        <UInput v-model="rate.note" class="w-full" data-testid="rate-period-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null && !isFirst"
        :label="loanWords.ratePeriodDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="rate-period-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="rate-period"
        :label="editing === null ? loanWords.ratePeriodDialog.add : loanWords.ratePeriodDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="rate-period-save"
      />
    </template>
  </AppDialog>
</template>
