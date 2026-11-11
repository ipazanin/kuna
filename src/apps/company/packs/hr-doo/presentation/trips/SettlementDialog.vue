<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { settleTrip, settlementDraftOf, tripOfSettlement } from '../../application/tripWrites'
import type { TripSettlementDraft } from '../../application/tripWrites'
import { perDiemLineCount } from '../../domain/trips/perDiems'
import { HOME_COUNTRY } from '../../domain/trips/trip'
import type { Trip } from '../../domain/trips/trip'
import { ruleValue } from '../../ruleset/ruleset'
import { dayProblem, fieldsValid, momentForInput, momentProblem, wholeProblem } from './tripsView'
import { words } from './words'

/** The settlement of a travel order: the times, the odometer of a private car, the meals per line of the per-diem table and the report. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  trip: Trip
}>()

const writes = useRecordWrites(useWorkbook())

type Fields = { -readonly [Field in Exclude<keyof TripSettlementDraft, 'meals'>]: string }

const fields = reactive<Fields>({ left: '', returned: '', borderOut: '', borderIn: '', odometerStart: '', odometerEnd: '', report: '', settledOn: '' })
const meals = ref<number[]>([])
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  const draft = settlementDraftOf(props.trip)
  Object.assign(fields, {
    ...draft,
    left: momentForInput(draft.left),
    returned: momentForInput(draft.returned),
    borderOut: momentForInput(draft.borderOut),
    borderIn: momentForInput(draft.borderIn),
  })
  meals.value = Array.from({ length: lines.value }, (_, index) => props.trip.meals[index] ?? 0)
})

const abroad = computed(() => props.trip.country !== HOME_COUNTRY)
const byAir = computed(() => props.trip.transport === 'plane')
const byPrivateCar = computed(() => props.trip.transport === 'private-car')

/** The settlement without the meals, whose lines the times set. */
const timed = computed((): TripSettlementDraft => ({
  ...fields,
  borderOut: abroad.value ? fields.borderOut : '',
  borderIn: abroad.value ? fields.borderIn : '',
  odometerStart: byPrivateCar.value ? fields.odometerStart : '',
  odometerEnd: byPrivateCar.value ? fields.odometerEnd : '',
  meals: '',
}))

const lines = computed(() => {
  const made = tripOfSettlement(props.trip, timed.value)
  return 'made' in made ? (perDiemLineCount(made.made, ruleValue) ?? 0) : 0
})

const mealItems = words.settlementDialog.mealCounts.map((label, count) => ({ label, value: count }))

watch(lines, (count) => {
  meals.value = Array.from({ length: count }, (_, index) => meals.value[index] ?? 0)
})

const draft = computed((): TripSettlementDraft => {
  const counts = Array.from({ length: lines.value }, (_, index) => meals.value[index] ?? 0)
  return { ...timed.value, meals: counts.some((count) => count > 0) ? counts.join(', ') : '' }
})

const errors = computed(() => ({
  left: momentProblem(fields.left),
  returned: momentProblem(fields.returned),
  borderOut: abroad.value ? momentProblem(fields.borderOut) : null,
  borderIn: abroad.value ? momentProblem(fields.borderIn) : null,
  odometerStart: byPrivateCar.value ? wholeProblem(fields.odometerStart, 0, false) : null,
  odometerEnd: byPrivateCar.value ? wholeProblem(fields.odometerEnd, 0, false) : null,
  settledOn: dayProblem(fields.settledOn, false),
}))

const refusal = computed(() => {
  const made = tripOfSettlement(props.trip, draft.value)
  return 'refused' in made ? made.refused : null
})

async function save(): Promise<void> {
  tried.value = true
  if (!fieldsValid(errors.value) || refusal.value !== null) return
  const before = props.trip
  const written = await writes.write(words.settlementDialog.saved, (unit) => settleTrip(unit, before, draft.value), { failedTitle: words.settlementDialog.notSaved })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.settlementDialog.title" :description="words.settlementDialog.description" width="2xl">
    <FormGrid id="trip-settlement" as="form" data-testid="trip-settlement-form" @submit.prevent="save">
      <UFormField :label="words.settlementDialog.left" :error="(tried && errors.left) || false">
        <UInput v-model="fields.left" type="datetime-local" class="w-full" data-testid="trip-left" />
      </UFormField>
      <UFormField :label="words.settlementDialog.returned" :error="(tried && errors.returned) || false">
        <UInput v-model="fields.returned" type="datetime-local" class="w-full" data-testid="trip-returned" />
      </UFormField>
      <template v-if="abroad">
        <UFormField :label="byAir ? words.settlementDialog.takeOff : words.settlementDialog.borderOut" :error="(tried && errors.borderOut) || false">
          <UInput v-model="fields.borderOut" type="datetime-local" class="w-full" />
        </UFormField>
        <UFormField :label="byAir ? words.settlementDialog.landing : words.settlementDialog.borderIn" :error="(tried && errors.borderIn) || false">
          <UInput v-model="fields.borderIn" type="datetime-local" class="w-full" />
        </UFormField>
      </template>
      <template v-if="byPrivateCar">
        <UFormField :label="words.settlementDialog.odometerStart" :error="(tried && errors.odometerStart) || false">
          <UInput v-model="fields.odometerStart" inputmode="numeric" class="w-full" />
        </UFormField>
        <UFormField :label="words.settlementDialog.odometerEnd" :error="(tried && errors.odometerEnd) || false">
          <UInput v-model="fields.odometerEnd" inputmode="numeric" class="w-full" />
        </UFormField>
      </template>
      <p class="type-caption sm:col-span-2" data-testid="trip-meals">{{ lines === 0 ? words.settlementDialog.mealsNeedTimes : words.settlementDialog.meals }}</p>
      <UFormField v-for="line in lines" :key="line" :label="words.settlementDialog.mealsOn(line)">
        <USelect v-model="meals[line - 1]" :items="mealItems" class="w-full" />
      </UFormField>
      <UFormField :label="words.settlementDialog.report" class="sm:col-span-2">
        <UTextarea v-model="fields.report" :rows="3" autoresize class="w-full" data-testid="trip-report" />
      </UFormField>
      <UFormField :label="words.settlementDialog.settledOn" :help="words.settlementDialog.settledHelp" :error="(tried && errors.settledOn) || false">
        <DayField v-model="fields.settledOn" class="w-full" />
      </UFormField>
      <UAlert
        v-if="tried && fieldsValid(errors) && refusal"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        :description="refusal"
        class="sm:col-span-2"
        data-testid="trip-settlement-refusal"
      />
    </FormGrid>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton type="submit" form="trip-settlement" :label="words.dialog.save" icon="i-lucide-save" :loading="writes.saving('save')" data-testid="trip-settlement-save" />
    </template>
  </AppDialog>
</template>
