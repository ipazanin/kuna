<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { INSTRUMENT_WRITES } from '../application/holdingWrites'
import { benchmarkChanges } from '../../performance/domain/benchmark'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import InstrumentFields from './InstrumentFields.vue'
import { instrumentErrors, instrumentOfTexts, instrumentTexts } from './instrumentForm'
import type { InstrumentTexts } from './instrumentForm'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** A holding's facts and the source of its daily closes, added or changed. Saving says which instrument it wrote. */
const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(
  defineProps<{
    /** The instrument to change, or null to add one. */
    instrument: Instrument | null
    book: InvestmentBook
    /** Adds the new instrument as the benchmark, in place of the one before it. */
    asBenchmark?: boolean
  }>(),
  { asBenchmark: false },
)

const emit = defineEmits<{
  saved: [instrument: Instrument]
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const text = words.instrumentDialog

const texts = ref<InstrumentTexts>(instrumentTexts(null))
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  texts.value = instrumentTexts(props.instrument)
  tried.value = false
})

const others = computed(() => props.book.instruments.filter((other) => other.id !== props.instrument?.id))
const errors = computed(() => instrumentErrors(texts.value, others.value))

async function save(): Promise<void> {
  tried.value = true
  const before = props.instrument
  const record = instrumentOfTexts(texts.value, others.value, before?.id ?? recordIdOf(INSTRUMENT_RECORDS, newRecordId()), before ?? { quoted: { kind: 'unit' }, benchmark: props.asBenchmark })
  if (record === null) return
  const unmarked = before === null && record.benchmark ? benchmarkChanges(others.value, record.id) : []
  const written =
    before === null
      ? await writes.write(
          text.added,
          (unit) => {
            const instruments = unit.of(INSTRUMENT_WRITES)
            instruments.add(record)
            unmarked.forEach((change) => instruments.change(change.before, change.after))
          },
          { failedTitle: text.notAdded },
        )
      : await writes.write(text.saved, (unit) => unit.of(INSTRUMENT_WRITES).change(before, record), { failedTitle: text.notSaved })
  if (!written) return
  emit('saved', record)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.instrument
  if (before === null) return
  if (await writes.write(text.deleted, (unit) => unit.of(INSTRUMENT_WRITES).remove(before), { failedTitle: text.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="instrument !== null ? text.changeTitle : asBenchmark ? text.addBenchmarkTitle : text.addTitle" :description="text.description" width="2xl">
    <FormGrid id="instrument" as="form" data-testid="instrument-form" @submit.prevent="save">
      <InstrumentFields v-model="texts" :errors="errors" :tried="tried" :book="book" />
    </FormGrid>
    <template #start>
      <UButton v-if="instrument !== null" :label="text.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="instrument-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="instrument"
        :label="instrument === null ? text.add : text.save"
        :icon="instrument === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="instrument-save"
      />
    </template>
  </AppDialog>
</template>
