<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../../../shared/ui/FormGrid.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { legDraftOf, legOfDraft, removeTripLeg, saveTripLeg } from '../../application/tripWrites'
import type { TripLegDraft } from '../../application/tripWrites'
import type { Trip, TripLeg } from '../../domain/trips/trip'
import { dayProblem, fieldsValid, wholeProblem } from './tripsView'
import { words } from './words'

/** One drive or ride of a trip, added or changed. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  trip: Trip
  /** The leg the dialog changes. Null adds a new one. */
  editing: TripLeg | null
}>()

const writes = useRecordWrites(useWorkbook())

const fields = reactive<{ -readonly [Field in keyof TripLegDraft]: string }>({ date: '', from: '', to: '', km: '' })
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  Object.assign(fields, props.editing === null ? { date: props.trip.left?.day ?? props.trip.departs, from: '', to: '', km: '' } : legDraftOf(props.editing))
})

const errors = computed(() => ({ date: dayProblem(fields.date, true), km: wholeProblem(fields.km, 1, true) }))

const refusal = computed(() => {
  const made = legOfDraft(props.trip, { ...fields }, props.editing)
  return 'refused' in made ? made.refused : null
})

async function save(): Promise<void> {
  tried.value = true
  if (!fieldsValid(errors.value) || refusal.value !== null) return
  const before = props.editing
  const written = await writes.write(before === null ? words.legDialog.added : words.legDialog.changed, (unit) => saveTripLeg(unit, props.trip, { ...fields }, before), {
    failedTitle: words.legDialog.notSaved,
  })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  const removed = await writes.write(words.legDialog.deleted, (unit) => removeTripLeg(unit, before), { key: 'delete', failedTitle: words.legDialog.notDeleted })
  if (removed) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing ? words.legDialog.changeTitle : words.legDialog.addTitle">
    <FormGrid id="trip-leg" as="form" data-testid="trip-leg-form" @submit.prevent="save">
      <UFormField :label="words.legDialog.from">
        <UInput v-model="fields.from" class="w-full" data-testid="trip-leg-from" />
      </UFormField>
      <UFormField :label="words.legDialog.to">
        <UInput v-model="fields.to" class="w-full" data-testid="trip-leg-to" />
      </UFormField>
      <UFormField :label="words.legDialog.date" :error="(tried && errors.date) || false">
        <UInput v-model="fields.date" type="date" class="w-full" />
      </UFormField>
      <UFormField :label="words.legDialog.km" :error="(tried && errors.km) || false">
        <UInput v-model="fields.km" inputmode="numeric" class="w-full" data-testid="trip-leg-km" />
      </UFormField>
      <UAlert v-if="tried && fieldsValid(errors) && refusal" icon="i-lucide-circle-alert" color="error" variant="subtle" :description="refusal" data-testid="trip-leg-refusal" />
    </FormGrid>
    <template #start>
      <UButton v-if="editing" :label="words.dialog.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :loading="writes.saving('delete')" data-testid="trip-leg-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="trip-leg"
        :label="editing ? words.dialog.save : words.dialog.add"
        :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'"
        :loading="writes.saving('save')"
        data-testid="trip-leg-save"
      />
    </template>
  </AppDialog>
</template>
