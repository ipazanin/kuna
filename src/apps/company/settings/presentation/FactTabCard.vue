<script setup lang="ts" generic="R extends { readonly id: RecordId }">
import { computed } from 'vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import { writeDrafts } from '../application/draftWrites'
import type { DraftFactory } from '../domain/recordDrafts'
import type { EditorColumn } from './factTabColumns'
import FactTabEditor from './FactTabEditor.vue'

/** A kind a person keeps by hand, as a card with its editor, on the page that reads the kind. */
const props = withDefaults(
  defineProps<{
    rules: WriteRules<R>
    title: string
    /** What the kind holds, under the title. */
    description: string
    collapseId: string
    columns: readonly EditorColumn[]
    read: (records: RecordsRead<R>) => Reading<{ readonly id: RecordId }>
    make: DraftFactory<R>
    newRow?: () => Readonly<Record<string, string>>
    /** Such as `asset`, for "Add asset" and "2 assets". */
    rowNoun: string
    /** Such as `assets`, for "Save assets". */
    tabNoun: string
    /** The toast once a save went through, such as "Assets saved". */
    savedTitle: string
    startCollapsed?: boolean
    /** True while a link points at the card, so it opens even when this device keeps it collapsed. */
    reveal?: boolean
  }>(),
  { newRow: () => ({}), startCollapsed: false, reveal: false },
)

const { state } = useWorkbook()
const writes = useRecordWrites()

const records = computed(() => (state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, props.rules.kind)))
const count = computed(() => records.value.records.length + records.value.refused.length)

function save(made: readonly { readonly saved: number | null; readonly record: R }[]): void {
  const stored = storedOf(records.value)
  void writes.write(props.savedTitle, (unit) => writeDrafts(unit.of(props.rules), stored, made), { failedTitle: 'Not saved' })
}
</script>

<template>
  <AppCard
    :title="title"
    :collapse-id="collapseId"
    :summary="`${count} ${count === 1 ? rowNoun : `${rowNoun}s`}`"
    :start-collapsed="startCollapsed"
    :reveal="reveal"
  >
    <template #subtitle>
      {{ description }}
    </template>
    <FactTabEditor
      :records="records"
      :columns="columns"
      :read="read"
      :make="make"
      :new-row="newRow"
      :row-noun="rowNoun"
      :tab-noun="tabNoun"
      :saving="writes.busy.value || state.writing"
      @save="save"
    />
  </AppCard>
</template>
