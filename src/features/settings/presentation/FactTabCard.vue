<script setup lang="ts">
import { computed } from 'vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import type { TabRowRules } from '../../workbook/application/tabRowWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import type { TabReading } from '../../workbook/infrastructure/cellReading'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import type { EditorColumn } from './factTabColumns'
import FactTabEditor from './FactTabEditor.vue'

/** A tab a person keeps by hand, as a card with its editor, on the page that reads the tab. */
const props = withDefaults(
  defineProps<{
    rules: TabRowRules
    title: string
    /** What the tab holds, under the title. */
    description: string
    collapseId: string
    columns: readonly EditorColumn[]
    read: (rows: readonly SheetRow[]) => TabReading<{ readonly sheetRow: number }>
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
const writes = useRowWrites(props.rules)

const tab = computed(() => props.rules.tab)
const rows = computed(() => state.snapshot?.[tab.value] ?? [])
const sheetLacks = computed(() => (state.choice?.source ?? state.workbook?.source) === 'google' && (state.snapshot?.meta.missingTabs.includes(tab.value) ?? false))
const headers = computed(() => TEMPLATE_COLUMNS[tab.value].map((column) => column.name).join(', '))

function save(change: TabRowsChange): void {
  void writes.write(change, { title: props.savedTitle }, 'Not saved')
}
</script>

<template>
  <AppCard
    :title="title"
    :collapse-id="collapseId"
    :summary="`${rows.length} ${rows.length === 1 ? rowNoun : `${rowNoun}s`}`"
    :start-collapsed="startCollapsed"
    :reveal="reveal"
  >
    <template #subtitle>
      {{ description }}
      <span v-if="sheetLacks" class="mt-2 block text-toned">
        The Sheet has no {{ tab }} tab yet. Add one named {{ tab }} with these headers in row 1, then sync:
        <span class="identifier">{{ headers }}</span>.
      </span>
    </template>
    <FactTabEditor
      :rows="rows"
      :columns="columns"
      :read="read"
      :new-row="newRow"
      :row-noun="rowNoun"
      :tab-noun="tabNoun"
      :saving="writes.busy.value || state.writing"
      @save="save"
    />
  </AppCard>
</template>
