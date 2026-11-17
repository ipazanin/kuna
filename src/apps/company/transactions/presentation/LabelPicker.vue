<script setup lang="ts">
import { computed } from 'vue'

import type { Label } from '../../../../shared/categorising/domain/labels'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import LabelPickerDialog from '../../../../shared/ui/LabelPickerDialog.vue'
import { addLabel, labelPackRecords, labelRows } from '../../labels/application/labelWrites'
import { newLabel } from '../../labels/domain/labels'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { storedItemsOfRow } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/workbook'
import { words } from './words'

/** Puts a label on every part of the picked rows and on the picked costs the owner paid, or takes off one all of them carry, in one write with Undo. A new label is added and put on in the same write. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The picked bank rows as booked. */
  rows: readonly Transaction[]
  /** The picked costs the owner paid, by their ids. */
  advances: ReadonlySet<RecordId>
}>()

const emit = defineEmits<{ done: [] }>()

const store = useWorkbook()
const writes = useRecordWrites(store)

const count = computed(() => props.rows.length + props.advances.size)
const picked = computed(() => plural(words.rows(count.value), count.value))

/** Each label of the books, and whether every part of every picked row carries it, so it comes off them. */
const choices = computed(() => {
  const { workbook, records } = store.state
  if (workbook === null || records === null) return []
  const items = props.rows.map((row) => storedItemsOfRow(records.items, row))
  const advances = workbook.ownerAdvances.filter((advance) => props.advances.has(advance.id))
  return workbook.labels.map((label) => ({
    label,
    onAll:
      count.value > 0 && items.every((parts) => parts.length > 0 && parts.every((item) => item.labels.includes(label.id))) && advances.every((advance) => advance.labels?.includes(label.id) ?? false),
  }))
})

async function apply(label: Label, on: boolean): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const title = on ? words.labelling.put(label.name, picked.value) : words.labelling.takenOff(label.name, picked.value)
  if (await writes.write(title, (unit) => labelPicked(unit, records, label.id, on), { key: label.id, failedTitle: words.labelling.notSaved })) done()
}

async function addAndApply(name: string): Promise<void> {
  const records = store.state.records
  if (records === null) return
  const label = newLabel(name)
  const write = (unit: UnitOfWork): void => {
    addLabel(unit, label)
    labelPicked(unit, records, label.id, true)
  }
  if (await writes.write(words.labelling.put(label.name, picked.value), write, { key: 'add', failedTitle: words.labelling.notSaved })) done()
}

function labelPicked(unit: UnitOfWork, records: WorkbookRecords, label: RecordId, on: boolean): void {
  labelRows(unit, records, props.rows, label, on)
  labelPackRecords(unit, records, props.advances, label, on)
}

function done(): void {
  open.value = false
  emit('done')
}
</script>

<template>
  <LabelPickerDialog
    v-model:open="open"
    :title="words.labelling.title(picked)"
    :description="words.labelling.description"
    :choices="choices"
    :saving="writes.saving"
    :busy="writes.busy.value"
    :changes-refused="writes.refused.value"
    @apply="apply"
    @add="addAndApply"
  />
</template>
