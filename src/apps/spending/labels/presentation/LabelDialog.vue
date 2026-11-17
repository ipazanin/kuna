<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { labelNameProblem } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { addLabel, deleteLabel, renameLabel } from '../application/labelWrites'
import { newLabel } from '../domain/labels'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** A label's name, or a new label, with Delete for one the file holds, which takes it off every entry in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The label to change, or null for a new one. */
  label: Label | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const name = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = props.label?.name ?? ''
  tried.value = false
})

const problem = computed(() => labelNameProblem(name.value, store.state.workbook?.labels ?? [], props.label?.id ?? null))
const error = computed(() => (problem.value === null ? null : words.dialog[problem.value]))

/** How many entries carry the label, which Delete takes it off. */
const carrying = computed(() => {
  const label = props.label
  const book = store.state.workbook
  if (label === null || book === null) return 0
  return new Set(book.items.flatMap((item) => (item.transaction !== null && item.labels.includes(label.id) ? [item.transaction] : []))).size
})

async function save(): Promise<void> {
  tried.value = true
  if (error.value !== null) return
  const changed = props.label
  const done =
    changed === null
      ? await writes.write(words.added, (unit) => addLabel(unit, newLabel(name.value)), { failedTitle: spendingWords.form.notAdded })
      : await writes.write(words.saved, (unit) => renameLabel(unit, changed, name.value), { failedTitle: spendingWords.form.notSaved })
  if (done) open.value = false
}

async function remove(): Promise<void> {
  const label = props.label
  const records = store.state.records
  if (label === null || records === null) return
  if (await writes.write(words.deleted, (unit) => deleteLabel(unit, records, label), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="label === null ? words.dialog.addTitle : words.dialog.changeTitle">
    <FormGrid id="spending-label" as="form" data-testid="spending-label-dialog" @submit.prevent="save">
      <UFormField
        :label="words.dialog.name"
        :error="(tried && error) || false"
        v-bind="label !== null && carrying > 0 ? { help: words.dialog.deleteHelp(plural(words.entries(carrying), carrying)) } : {}"
        class="sm:col-span-2"
      >
        <UInput v-model="name" class="w-full" data-testid="spending-label-name" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="label !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-label-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-label"
        :label="label === null ? words.dialog.add : words.dialog.save"
        :icon="label === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-label-save"
      />
    </template>
  </AppDialog>
</template>
