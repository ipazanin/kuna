<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { addEvent, changeEvent, deleteEvent } from '../application/eventWrites'
import { eventProblem, newEvent } from '../domain/events'
import { words as eventWords } from '../domain/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingEvent } from '../../workbook/domain/event'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** An event's name and days, or a new event, with Delete for one the file holds, which puts the parts put in it by hand back on their days. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The event to change, or null for a new one. */
  event: SpendingEvent | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const name = ref('')
const from = ref('')
const to = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.event?.name ?? ''
  from.value = props.event?.days.from ?? ''
  to.value = props.event?.days.to ?? ''
  tried.value = false
})

const days = computed(() => {
  const [first, last] = [parseCivilDate(from.value), parseCivilDate(to.value)]
  return first === null || last === null ? null : { from: first, to: last }
})

const errors = computed(() => {
  const problem = days.value === null ? null : eventProblem(name.value, days.value)
  return {
    name: name.value.trim() === '' ? eventWords.blank : null,
    from: parseCivilDate(from.value) === null ? words.dialog.noDay : null,
    to: parseCivilDate(to.value) === null ? words.dialog.noDay : problem === 'ends-before' ? eventWords.endsBefore : null,
  }
})

/** How many parts were put in the event by hand, which Delete puts back on their days. */
const putIn = computed(() => {
  const event = props.event
  const book = store.state.workbook
  return event === null || book === null ? 0 : book.items.filter((item) => item.event === event.id).length
})

async function save(): Promise<void> {
  tried.value = true
  const chosen = days.value
  if (chosen === null || Object.values(errors.value).some((error) => error !== null)) return
  const changed = props.event
  const done =
    changed === null
      ? await writes.write(words.added, (unit) => addEvent(unit, newEvent(name.value, chosen)), { failedTitle: spendingWords.form.notAdded })
      : await writes.write(words.saved, (unit) => changeEvent(unit, changed, { name: name.value, days: chosen }), { failedTitle: spendingWords.form.notSaved })
  if (done) open.value = false
}

async function remove(): Promise<void> {
  const event = props.event
  const records = store.state.records
  if (event === null || records === null) return
  if (await writes.write(words.deleted, (unit) => deleteEvent(unit, records, event), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="event === null ? words.dialog.addTitle : words.dialog.changeTitle">
    <FormGrid id="spending-event" as="form" data-testid="spending-event-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.name" :error="(tried && errors.name) || false" class="sm:col-span-2">
        <UInput v-model="name" class="w-full" data-testid="spending-event-name" />
      </UFormField>
      <UFormField :label="words.dialog.from" :error="(tried && errors.from) || false">
        <DayField v-model="from" class="w-full" data-testid="spending-event-from" />
      </UFormField>
      <UFormField :label="words.dialog.to" :error="(tried && errors.to) || false">
        <DayField v-model="to" v-bind="from === '' ? {} : { min: from }" class="w-full" data-testid="spending-event-to" />
      </UFormField>
      <p class="type-caption sm:col-span-2">
        {{ event !== null && putIn > 0 ? words.dialog.deleteHelp(plural(words.dialog.parts(putIn), putIn)) : words.dialog.help }}
      </p>
    </FormGrid>
    <template #start>
      <UButton
        v-if="event !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-event-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-event"
        :label="event === null ? words.dialog.add : words.dialog.save"
        :icon="event === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-event-save"
      />
    </template>
  </AppDialog>
</template>
