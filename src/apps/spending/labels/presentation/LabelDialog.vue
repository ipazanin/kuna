<script setup lang="ts">
import { computed } from 'vue'
import type { Label } from '../../../../shared/categorising/domain/labels'

import { addLabel, deleteLabel, renameLabel } from '../application/labelWrites'
import { newLabel } from '../domain/labels'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import LabelNameDialog from '../../../../shared/ui/LabelNameDialog.vue'

/** A label's name, or a new label, with Delete for one the file holds, which takes it off every entry in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The label to change, or null for a new one. */
  label: Label | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

/** How many entries carry the label, which Delete takes it off. */
const carrying = computed(() => {
  const label = props.label
  const book = store.state.workbook
  if (label === null || book === null) return 0
  return new Set(book.items.flatMap((item) => (item.transaction !== null && item.labels.includes(label.id) ? [item.transaction] : []))).size
})

async function save(name: string): Promise<void> {
  const changed = props.label
  const done =
    changed === null
      ? await writes.write(words.added, (unit) => addLabel(unit, newLabel(name)), { failedTitle: spendingWords.form.notAdded })
      : await writes.write(words.saved, (unit) => renameLabel(unit, changed, name), { failedTitle: spendingWords.form.notSaved })
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
  <LabelNameDialog
    v-model:open="open"
    :label="label"
    :labels="store.state.workbook?.labels ?? []"
    :delete-help="carrying > 0 ? words.deleteHelp(plural(words.entries(carrying), carrying)) : null"
    :saving="writes.saving"
    :busy="writes.busy.value"
    :changes-refused="writes.refused.value"
    @save="save"
    @remove="remove"
  />
</template>
