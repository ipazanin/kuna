<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { RATE_PERIOD_WRITES, newRatePeriod } from '../application/bankLoanWrites'
import { rateText } from '../domain/yearlyRate'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import RateFields, { rateError, typedRate } from './RateFields.vue'
import type { RateTexts } from './RateFields.vue'

/** A rate the loan pays from one of its due dates on. The first period always starts at the first instalment. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
  /** The period to change, or null to add one. */
  editing: RatePeriod | null
}>()

const writes = useRecordWrites(useLoansBooks())
const phone = usePhoneLayout()

const from = ref('')
const rate = ref<RateTexts>({ rate: '', rateType: 'variable', note: '' })
const tried = ref(false)

const isFirst = computed(() => props.editing?.from === props.book.loan.firstInstalment)

/** The due dates a new rate can start on: every instalment after the first that no other period starts on. */
const dueItems = computed(() => {
  const { loan } = props.book
  const taken = new Set(props.book.ratePeriods.filter((period) => period.id !== props.editing?.id).map((period) => period.from))
  return Array.from({ length: loan.instalments }, (_, offset) => ({ number: offset + 1, date: dayMonthsLater(loan.firstInstalment, offset) }))
    .filter(({ number, date }) => (isFirst.value ? number === 1 : number > 1) && !taken.has(date))
    .map(({ number, date }): { label: string; value: string } => ({ label: `${dayLabel(date)}, instalment ${number}`, value: date }))
})

watch(open, (opened) => {
  if (!opened) return
  const period = props.editing
  from.value = period?.from ?? ''
  rate.value = period === null ? { rate: '', rateType: 'variable', note: '' } : { rate: rateText(period.rate), rateType: period.rateType, note: period.note }
  tried.value = false
})

const errors = computed(() => ({
  from: dueItems.value.some((item) => item.value === from.value) ? null : 'Choose the due date of the first instalment at this rate',
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
      ? await writes.write('Rate period added', (unit) => unit.of(RATE_PERIOD_WRITES).add(typed), { failedTitle: 'Not added' })
      : await writes.write('Rate period saved', (unit) => unit.of(RATE_PERIOD_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: 'Not saved' })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write('Rate period deleted', (unit) => unit.of(RATE_PERIOD_WRITES).remove(before), { failedTitle: 'Not deleted' })) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing === null ? 'Add a rate period' : 'Change the rate period'"
    description="The rate the bank applies from a due date until the next period. Kuna works out the instalment again on what is left."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="rate-period" class="grid gap-4 sm:grid-cols-2" data-testid="rate-period-form" @submit.prevent="save">
        <UFormField label="From the instalment due" :error="(tried && errors.from) || false" help="The first period starts at the first instalment." class="sm:col-span-2">
          <USelectMenu
            v-model="from"
            :items="dueItems"
            value-key="value"
            :disabled="isFirst"
            placeholder="Choose a due date"
            :search-input="{ placeholder: 'Search due dates' }"
            class="w-full"
            data-testid="rate-period-from"
          />
        </UFormField>
        <RateFields v-model="rate" :tried="tried" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="editing !== null && !isFirst"
          label="Delete period"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="rate-period-delete"
          @click="remove"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="rate-period"
            :label="editing === null ? 'Add period' : 'Save period'"
            :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="rate-period-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
