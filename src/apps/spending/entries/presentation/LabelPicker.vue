<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { words } from './words'
import { addLabel, labelRows } from '../../labels/application/labelWrites'
import { labelNameProblem } from '../../labels/domain/labels'
import { words as labelWords } from '../../labels/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Label } from '../../workbook/domain/label'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'

/** Puts a label on the picked entries, or takes off one every picked entry carries, in one write with Undo. A new label is added and put on in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  rows: readonly Transaction[]
}>()

const emit = defineEmits<{ done: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const name = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  name.value = ''
  tried.value = false
})

const count = computed(() => props.rows.length)
const entries = computed(() => plural(labelWords.entries(count.value), count.value))

/** Each label of the file, and whether every picked entry carries it on all of its parts, so it comes off them. */
const choices = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const itemsOf = rowItemsOf(book)
  return book.labels.map((label) => ({ label, onAll: props.rows.length > 0 && props.rows.every((row) => itemsOf(row).every((item) => item.labels.includes(label.id))) }))
})

const problem = computed(() => labelNameProblem(name.value, store.state.workbook?.labels ?? [], null))
const error = computed(() => (problem.value === null ? null : labelWords.dialog[problem.value]))

async function apply(label: Label, on: boolean): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const title = on ? words.labelling.put(label.name, entries.value) : words.labelling.takenOff(label.name, entries.value)
  if (await writes.write(title, (unit) => labelRows(unit, records, props.rows, label.id, on), { key: label.id, failedTitle: spendingWords.form.notSaved })) done()
}

async function addAndApply(): Promise<void> {
  tried.value = true
  const records = store.state.records
  if (error.value !== null || records === null) return
  const typed = name.value.trim()
  const title = words.labelling.put(typed, entries.value)
  if (await writes.write(title, (unit) => labelRows(unit, records, props.rows, addLabel(unit, typed).id, true), { key: 'add', failedTitle: spendingWords.form.notSaved })) done()
}

function done(): void {
  open.value = false
  emit('done')
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="words.labelling.title(entries)" :description="words.labelling.description">
    <div class="flex flex-col gap-4" data-testid="spending-label-picker">
      <ul v-if="choices.length > 0" class="flex flex-col">
        <ProposalRow v-for="choice in choices" :key="choice.label.id" :title="choice.label.name" flush class="border-t border-default first:border-t-0" data-testid="spending-label-choice">
          <div class="flex">
            <UButton
              :label="choice.onAll ? words.labelling.takeOff : words.labelling.putOn"
              :icon="choice.onAll ? 'i-lucide-x' : 'i-lucide-tag'"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="writes.saving(choice.label.id)"
              :disabled="writes.busy.value || writes.refused.value"
              data-testid="spending-label-apply"
              @click="apply(choice.label, !choice.onAll)"
            />
          </div>
        </ProposalRow>
      </ul>
      <FormGrid id="spending-label-new" as="form" @submit.prevent="addAndApply">
        <UFormField :label="words.labelling.newLabel" :error="(tried && error) || false" class="sm:col-span-2">
          <div class="flex gap-2">
            <UInput v-model="name" class="min-w-0 flex-1" data-testid="spending-label-new-name" />
            <UButton
              type="submit"
              :label="words.labelling.addAndPut"
              icon="i-lucide-plus"
              :loading="writes.saving('add')"
              :disabled="writes.busy.value || writes.refused.value"
              data-testid="spending-label-new-add"
            />
          </div>
        </UFormField>
      </FormGrid>
    </div>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </AppDialog>
</template>
