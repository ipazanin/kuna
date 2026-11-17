<script setup lang="ts">
import { computed } from 'vue'
import type { Label } from '../../../../shared/categorising/domain/labels'

import { words } from './words'
import { addLabel, labelRows } from '../../labels/application/labelWrites'
import { newLabel } from '../../labels/domain/labels'
import { words as labelWords } from '../../labels/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import LabelPickerDialog from '../../../../shared/ui/LabelPickerDialog.vue'

/** Puts a label on the picked entries, or takes off one every picked entry carries, in one write with Undo. A new label is added and put on in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  rows: readonly Transaction[]
}>()

const emit = defineEmits<{ done: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const count = computed(() => props.rows.length)
const entries = computed(() => plural(labelWords.entries(count.value), count.value))

/** Each label of the file, and whether every picked entry carries it on all of its parts, so it comes off them. */
const choices = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const itemsOf = rowItemsOf(book)
  return book.labels.map((label) => ({ label, onAll: props.rows.length > 0 && props.rows.every((row) => itemsOf(row).every((item) => item.labels.includes(label.id))) }))
})

async function apply(label: Label, on: boolean): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const title = on ? words.labelling.put(label.name, entries.value) : words.labelling.takenOff(label.name, entries.value)
  if (await writes.write(title, (unit) => labelRows(unit, records, props.rows, label.id, on), { key: label.id, failedTitle: spendingWords.form.notSaved })) done()
}

async function addAndApply(name: string): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const label = newLabel(name)
  const title = words.labelling.put(label.name, entries.value)
  const write = (unit: UnitOfWork): void => {
    addLabel(unit, label)
    labelRows(unit, records, props.rows, label.id, true)
  }
  if (await writes.write(title, write, { key: 'add', failedTitle: spendingWords.form.notSaved })) done()
}

function done(): void {
  open.value = false
  emit('done')
}
</script>

<template>
  <LabelPickerDialog
    v-model:open="open"
    :title="words.labelling.title(entries)"
    :description="words.labelling.description"
    :choices="choices"
    :saving="writes.saving"
    :busy="writes.busy.value"
    :changes-refused="writes.refused.value"
    @apply="apply"
    @add="addAndApply"
  />
</template>
