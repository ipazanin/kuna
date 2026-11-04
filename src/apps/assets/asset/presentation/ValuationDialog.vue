<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { VALUATION_WRITES, newValuation } from '../application/assetWrites'
import { useAssetsBooks } from '../../workbook/application/assetsStore'
import type { AssetWithValuations } from '../../workbook/domain/readAssetBook'
import type { Valuation } from '../../workbook/domain/valuation'
import { words as assetsWords } from '../../words'
import { words } from './words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** What the asset was worth on a day, as you typed it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entry: AssetWithValuations
  /** The valuation to change, or null to add one. */
  editing: Valuation | null
  /** Where a new valuation's date starts. */
  today: CivilDate
}>()

const writes = useRecordWrites(useAssetsBooks())

const date = ref('')
const value = ref('')
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const valuation = props.editing
  date.value = valuation?.date ?? props.today
  value.value = valuation === null ? '' : plainAmount(valuation.value)
  note.value = valuation?.note ?? ''
  tried.value = false
})

const typedValue = computed(() => {
  const cents = typedAmount(value.value)
  return cents !== null && cents >= 0 ? cents : null
})

const errors = computed(() => {
  const day = parseCivilDate(date.value)
  const { bought } = props.entry.asset
  return {
    date:
      day === null
        ? assetsWords.form.aDate(civilDate(2026, 5, 1))
        : bought !== null && day < bought
          ? words.valuationDialog.notBeforeBought
          : props.entry.valuations.some((other) => other.date === day && other.id !== props.editing?.id)
            ? words.valuationDialog.sharesDay
            : null,
    value: typedValue.value === null ? words.valuationDialog.anAmount : null,
  }
})

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (Object.values(errors.value).some((error) => error !== null) || day === null || typedValue.value === null) return
  const typed = newValuation({ asset: props.entry.asset.id, date: day, value: typedValue.value, note: note.value })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(words.valuationDialog.added, (unit) => unit.of(VALUATION_WRITES).add(typed), { failedTitle: assetsWords.form.notAdded })
      : await writes.write(words.valuationDialog.saved, (unit) => unit.of(VALUATION_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: assetsWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(words.valuationDialog.deleted, (unit) => unit.of(VALUATION_WRITES).remove(before), { key: 'delete', failedTitle: assetsWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing === null ? words.valuationDialog.addTitle : words.valuationDialog.changeTitle" :description="words.valuationDialog.description(entry.asset.name)">
    <FormGrid id="valuation" as="form" data-testid="valuation-form" @submit.prevent="save">
      <UFormField :label="words.valuationDialog.date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="valuation-date" />
      </UFormField>
      <UFormField :label="words.valuationDialog.value" :error="(tried && errors.value) || false">
        <MoneyInput v-model="value" :placeholder="assetsWords.form.amountPlaceholder" class="w-full" data-testid="valuation-value" />
      </UFormField>
      <UFormField :label="assetsWords.form.note" :help="words.valuationDialog.noteHelp" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="valuation-note" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="words.valuationDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="valuation-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="assetsWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="valuation"
        :label="editing === null ? words.valuationDialog.add : words.valuationDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value"
        data-testid="valuation-save"
      />
    </template>
  </AppDialog>
</template>
