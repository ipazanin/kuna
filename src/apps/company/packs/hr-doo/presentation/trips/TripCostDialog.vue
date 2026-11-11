<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import CurrencySelect from '../../../../../../shared/ui/CurrencySelect.vue'
import DayField from '../../../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../../../shared/ui/MoneyInput.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { costDraftOf, costOfDraft, removeTripCost, saveTripCost } from '../../application/tripWrites'
import type { TripCostDraft } from '../../application/tripWrites'
import { TRIP_COST_KINDS, TRIP_COST_PAYERS } from '../../domain/trips/trip'
import type { Trip, TripCost } from '../../domain/trips/trip'
import { amountProblem, dayProblem, draftAmount, fieldsValid, typingAmount } from './tripsView'
import { decimalOfText } from '../../../../../../shared/money/decimal'
import { words } from './words'

/** A ticket, a night or another cost of a trip, with who paid it, added or changed. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  trip: Trip
  /** The cost the dialog changes. Null adds a new one. */
  editing: TripCost | null
}>()

const writes = useRecordWrites(useWorkbook())

const fields = reactive<{ -readonly [Field in keyof TripCostDraft]: string }>({ date: '', kind: 'ticket', description: '', amount: '', foreignAmount: '', currency: '', paidBy: 'traveller' })
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  if (props.editing === null) {
    Object.assign(fields, { date: props.trip.left?.day ?? props.trip.departs, kind: 'ticket', description: '', amount: '', foreignAmount: '', currency: '', paidBy: 'traveller' })
    return
  }
  const draft = costDraftOf(props.editing)
  Object.assign(fields, { ...draft, amount: typingAmount(draft.amount) })
})

const kindItems = TRIP_COST_KINDS.map((kind): { label: string; value: string } => ({ label: words.costKinds[kind], value: kind }))
const payerItems = TRIP_COST_PAYERS.map((payer): { label: string; value: string } => ({ label: words.payers[payer], value: payer }))

const draft = computed((): TripCostDraft => ({ ...fields, amount: draftAmount(fields.amount) }))

/** A foreign amount above zero and its currency go together. */
const errors = computed(() => {
  const foreign = fields.foreignAmount.trim()
  const stated = decimalOfText(foreign)
  return {
    date: dayProblem(fields.date, true),
    amount: amountProblem(fields.amount, true),
    foreignAmount: foreign === '' ? (fields.currency === '' ? null : words.dialog.required) : stated === null || stated <= 0n ? words.dialog.notAnAmount : null,
    currency: foreign !== '' && fields.currency === '' ? words.dialog.required : null,
  }
})

const refusal = computed(() => {
  const made = costOfDraft(props.trip, draft.value, props.editing)
  return 'refused' in made ? made.refused : null
})

async function save(): Promise<void> {
  tried.value = true
  if (!fieldsValid(errors.value) || refusal.value !== null) return
  const before = props.editing
  const written = await writes.write(before === null ? words.costDialog.added : words.costDialog.changed, (unit) => saveTripCost(unit, props.trip, draft.value, before), {
    failedTitle: words.costDialog.notSaved,
  })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  const removed = await writes.write(words.costDialog.deleted, (unit) => removeTripCost(unit, before), { key: 'delete', failedTitle: words.costDialog.notDeleted })
  if (removed) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing ? words.costDialog.changeTitle : words.costDialog.addTitle">
    <FormGrid id="trip-cost" as="form" data-testid="trip-cost-form" @submit.prevent="save">
      <UFormField :label="words.costDialog.date" :error="(tried && errors.date) || false">
        <DayField v-model="fields.date" class="w-full" />
      </UFormField>
      <UFormField :label="words.costDialog.kind">
        <USelect v-model="fields.kind" :items="kindItems" class="w-full" data-testid="trip-cost-kind" />
      </UFormField>
      <UFormField :label="words.costDialog.description" class="sm:col-span-2">
        <UInput v-model="fields.description" class="w-full" data-testid="trip-cost-description" />
      </UFormField>
      <UFormField :label="words.costDialog.amount" :help="words.costDialog.amountHelp" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="fields.amount" class="w-full" data-testid="trip-cost-amount" />
      </UFormField>
      <UFormField :label="words.costDialog.paidBy">
        <USelect v-model="fields.paidBy" :items="payerItems" class="w-full" data-testid="trip-cost-paid-by" />
      </UFormField>
      <UFormField :label="words.costDialog.foreignAmount" :help="words.costDialog.foreignHelp" :error="(tried && errors.foreignAmount) || false">
        <UInput v-model="fields.foreignAmount" inputmode="decimal" class="w-full" />
      </UFormField>
      <UFormField :label="words.costDialog.currency" :error="(tried && errors.currency) || false">
        <CurrencySelect v-model="fields.currency" :search="words.costDialog.findCurrency" :first="[]" :none="words.costDialog.noCurrency" class="w-full" data-testid="trip-cost-currency" />
      </UFormField>
      <UAlert v-if="tried && fieldsValid(errors) && refusal" icon="i-lucide-circle-alert" color="error" variant="subtle" :description="refusal" data-testid="trip-cost-refusal" />
    </FormGrid>
    <template #start>
      <UButton v-if="editing" :label="words.dialog.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :loading="writes.saving('delete')" data-testid="trip-cost-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="trip-cost"
        :label="editing ? words.dialog.save : words.dialog.add"
        :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'"
        :loading="writes.saving('save')"
        data-testid="trip-cost-save"
      />
    </template>
  </AppDialog>
</template>
