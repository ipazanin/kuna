<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { INSTRUMENT_WRITES } from '../../holdings/application/holdingWrites'
import InstrumentDialog from '../../holdings/presentation/InstrumentDialog.vue'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { benchmarkChanges, benchmarkOf, benchmarkState } from '../../performance/domain/benchmark'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** Which instrument Performance compares the portfolio with, the last close the prices file holds of it, and a way to add one that is not held. */
const store = useInvestmentsBooks()
const { state } = store
const writes = useRecordWrites(store)
const { sources } = usePortfolio()
const text = words.benchmark

/** Kept apart from every record id, so the select can offer no benchmark at all. */
const NONE = 'none'

const instruments = computed(() => state.workbook?.book.instruments ?? [])
const chosen = computed(() => benchmarkOf(instruments.value))
const items = computed(() => [{ label: text.none, value: NONE }, ...instruments.value.map((instrument) => ({ label: `${instrument.name} (${instrument.symbol})`, value: instrument.id }))])
const closeLine = computed(() => {
  const standing = sources.value === null ? null : benchmarkState(sources.value)
  if (standing === null || standing.kind === 'none') return ''
  return standing.kind === 'no-closes' ? text.noCloses : standing.late ? text.lateClose(dayLabel(standing.close.date)) : text.lastClose(dayLabel(standing.close.date))
})
const adding = ref(false)

async function choose(value: string): Promise<void> {
  const picked = instruments.value.find((instrument) => instrument.id === value) ?? null
  const changes = benchmarkChanges(instruments.value, picked?.id ?? null)
  if (changes.length === 0) return
  await writes.write(
    picked === null ? text.cleared : text.chosen(picked.name),
    (unit) => {
      const repository = unit.of(INSTRUMENT_WRITES)
      changes.forEach((change) => repository.change(change.before, change.after))
    },
    { failedTitle: text.notChosen },
  )
}
</script>

<template>
  <AppCard v-if="state.workbook !== null" :title="text.title" :subtitle="text.subtitle" data-testid="investments-benchmark">
    <div class="flex flex-col gap-3 px-4 pt-1 pb-4 sm:px-5">
      <UFormField :label="text.compareWith" :help="closeLine === '' ? text.help : closeLine">
        <USelect :model-value="chosen?.id ?? NONE" :items="items" :disabled="writes.busy.value" class="w-full" data-testid="benchmark-choice" @update:model-value="choose(String($event))" />
      </UFormField>
      <div>
        <UButton :label="text.add" icon="i-lucide-plus" color="neutral" variant="outline" data-testid="benchmark-add" @click="adding = true" />
      </div>
    </div>
    <InstrumentDialog v-model:open="adding" :instrument="null" :book="state.workbook.book" as-benchmark />
  </AppCard>
</template>
