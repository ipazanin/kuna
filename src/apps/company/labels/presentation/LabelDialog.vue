<script setup lang="ts">
import { computed } from 'vue'

import type { Label } from '../../../../shared/categorising/domain/labels'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import LabelNameDialog from '../../../../shared/ui/LabelNameDialog.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { addLabel, deleteLabel, renameLabel } from '../application/labelWrites'
import { newLabel } from '../domain/labels'
import { words } from './words'

/** A label's name, or a new label, with Delete for one the books hold, which takes it off every part in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The label to change, or null for a new one. */
  label: Label | null
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)

/** How many parts of rows carry the label, which Delete takes it off. */
const carrying = computed(() => {
  const label = props.label
  const records = store.state.records
  if (label === null || records === null) return 0
  return recordsOf(records.items).filter((item) => item.labels.includes(label.id)).length
})

async function save(name: string): Promise<void> {
  const changed = props.label
  const done =
    changed === null
      ? await writes.write(words.added, (unit) => addLabel(unit, newLabel(name)), { failedTitle: words.notAdded })
      : await writes.write(words.saved, (unit) => renameLabel(unit, changed, name), { failedTitle: words.notSaved })
  if (done) open.value = false
}

async function remove(): Promise<void> {
  const label = props.label
  const records = store.state.records
  if (label === null || records === null) return
  if (await writes.write(words.deleted, (unit) => deleteLabel(unit, records, label), { key: 'delete', failedTitle: words.notDeleted })) open.value = false
}
</script>

<template>
  <LabelNameDialog
    v-model:open="open"
    :label="label"
    :labels="store.state.workbook?.labels ?? []"
    :delete-help="carrying > 0 ? words.deleteHelp(plural(words.parts(carrying), carrying)) : null"
    :saving="writes.saving"
    :busy="writes.busy.value"
    :changes-refused="writes.refused.value"
    @save="save"
    @remove="remove"
  />
</template>
