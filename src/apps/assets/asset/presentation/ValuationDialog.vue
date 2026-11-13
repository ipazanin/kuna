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
import { typedValuationTerms } from './valuationTexts'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
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

const typed = computed(() =>
  typedValuationTerms({ date: date.value, value: value.value }, { bought: props.entry.asset.bought, valuations: props.entry.valuations, editing: props.editing?.id ?? null }),
)
const errors = computed(() => typed.value.errors)

async function save(): Promise<void> {
  tried.value = true
  const { terms } = typed.value
  if (terms === null) return
  const valuation = newValuation({ asset: props.entry.asset.id, date: terms.date, value: terms.value, note: note.value })
  const before = props.editing
  const written =
    before === null
      ? await writes.write(words.valuationDialog.added, (unit) => unit.of(VALUATION_WRITES).add(valuation), { failedTitle: assetsWords.form.notAdded })
      : await writes.write(words.valuationDialog.saved, (unit) => unit.of(VALUATION_WRITES).change(before, { ...valuation, id: before.id }), { failedTitle: assetsWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(words.valuationDialog.deleted, (unit) => unit.of(VALUATION_WRITES).remove(before), { key: 'delete', failedTitle: assetsWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="editing === null ? words.valuationDialog.addTitle : words.valuationDialog.changeTitle"
    :description="words.valuationDialog.description(entry.asset.name)"
  >
    <FormGrid id="valuation" as="form" data-testid="valuation-form" @submit.prevent="save">
      <UFormField :label="words.valuationDialog.date" :error="(tried && errors.date) || false">
        <DayField v-model="date" class="w-full" data-testid="valuation-date" />
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
        :disabled="writes.busy.value || writes.refused.value"
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
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="valuation-save"
      />
    </template>
  </AppDialog>
</template>
