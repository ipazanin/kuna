<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { INSTRUMENT_WRITES } from '../application/holdingWrites'
import { FUND_MIX_WRITES, replaceRows } from '../application/mixWrites'
import { benchmarkChanges } from '../../performance/domain/benchmark'
import { fetchAddedInBackground } from '../../prices/presentation/pricesStep'
import { usePrices } from '../../prices/presentation/usePrices'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import InstrumentFields from './InstrumentFields.vue'
import InstrumentMixRows from './InstrumentMixRows.vue'
import InstrumentSearch from './InstrumentSearch.vue'
import { instrumentErrors, instrumentOfTexts, instrumentTexts, withListing } from './instrumentForm'
import type { InstrumentTexts } from './instrumentForm'
import { fundMixChanges, fundMixErrors, fundMixTexts } from './instrumentMixForm'
import type { FundMixTexts } from './instrumentMixForm'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INSTRUMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import { words } from './words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
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
const prices = usePrices()
const text = words.instrumentDialog

const texts = ref<InstrumentTexts>(instrumentTexts(null))
const mixTexts = ref<FundMixTexts>(fundMixTexts([]))
const tried = ref(false)

/** The instrument's own mix as the file holds it. */
const heldLines = computed(() => props.book.fundMixes.filter((line) => line.instrument === props.instrument?.id))

watch(open, (opened) => {
  if (!opened) return
  texts.value = instrumentTexts(props.instrument)
  mixTexts.value = fundMixTexts(heldLines.value)
  tried.value = false
})

const others = computed(() => props.book.instruments.filter((other) => other.id !== props.instrument?.id))
const errors = computed(() => instrumentErrors(texts.value, others.value))
const mixErrors = computed(() => fundMixErrors(mixTexts.value))

async function save(): Promise<void> {
  tried.value = true
  const before = props.instrument
  const id = before?.id ?? recordIdOf(INSTRUMENT_RECORDS, newRecordId())
  const record = instrumentOfTexts(texts.value, others.value, id, before ?? { benchmark: props.asBenchmark })
  const mixes = fundMixChanges(mixTexts.value, heldLines.value, id)
  if (record === null || mixes === null) return
  const writeMixes = (unit: UnitOfWork): void => mixes.forEach((mix) => replaceRows(unit, FUND_MIX_WRITES, mix.held, mix.wanted))
  const unmarked = before === null && record.benchmark ? benchmarkChanges(others.value, record.id) : []
  const written =
    before === null
      ? await writes.write(
          text.added,
          (unit) => {
            const instruments = unit.of(INSTRUMENT_WRITES)
            instruments.add(record)
            unmarked.forEach((change) => instruments.change(change.before, change.after))
            writeMixes(unit)
          },
          { failedTitle: text.notAdded },
        )
      : await writes.write(
          text.saved,
          (unit) => {
            unit.of(INSTRUMENT_WRITES).change(before, record)
            writeMixes(unit)
          },
          { failedTitle: text.notSaved },
        )
  if (!written) return
  if (record.prices !== 'manual') fetchAddedInBackground(prices)
  emit('saved', record)
  open.value = false
}

async function remove(): Promise<void> {
  const before = props.instrument
  if (before === null) return
  const removed = await writes.write(
    text.deleted,
    (unit) => {
      replaceRows(unit, FUND_MIX_WRITES, heldLines.value, [])
      unit.of(INSTRUMENT_WRITES).remove(before)
    },
    { key: 'delete', failedTitle: text.notDeleted },
  )
  if (removed) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="instrument !== null ? text.changeTitle : asBenchmark ? text.addBenchmarkTitle : text.addTitle" :description="text.description" width="2xl">
    <FormGrid id="instrument" as="form" data-testid="instrument-form" @submit.prevent="save">
      <InstrumentSearch @pick="texts = withListing(texts, $event)" />
      <InstrumentFields v-model="texts" :errors="errors" :tried="tried" :book="book" :instrument="instrument" />
      <InstrumentMixRows v-model="mixTexts" :errors="mixErrors" :tried="tried" />
    </FormGrid>
    <template #start>
      <UButton
        v-if="instrument !== null"
        :label="text.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="instrument-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="text.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="instrument"
        :label="instrument === null ? text.add : text.save"
        :icon="instrument === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value"
        data-testid="instrument-save"
      />
    </template>
  </AppDialog>
</template>
