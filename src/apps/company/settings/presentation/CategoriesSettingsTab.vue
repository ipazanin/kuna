<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import { LINKED_SETTINGS_TAB } from './settingsTabs'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { NO_RECORDS, storedOf } from '../../../../shared/storage/domain/recordsRead'
import { fillShares } from '../../owner-share/application/ownerShareWrites'
import { shareFillsOf } from '../../owner-share/domain/ownerShare'
import type { ShareFill } from '../../owner-share/domain/ownerShare'
import ShareFillDialog from '../../owner-share/presentation/ShareFillDialog.vue'
import { installedPack } from '../../packs/packContribution'
import { useSettings } from '../application/useSettings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { writeDrafts } from '../application/draftWrites'
import { CATEGORY_WRITES, categoryUses } from '../application/namedRecordWrites'
import type { RecordsOfKind } from '../application/namedRecordWrites'
import { knownRoles } from '../domain/categoryGuards'
import CategoriesEditor from './CategoriesEditor.vue'
import { rowsInWords, storedCount } from './settingsCounts'

const { state } = useWorkbook()
const settings = useSettings()
const linkedTab = inject(LINKED_SETTINGS_TAB, null)
const linked = computed(() => linkedTab?.value === 'categories')
const writes = useRecordWrites(useWorkbook())

const recordsOnScreen: RecordsOfKind = (kind) => (state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, kind))
const categoriesInUse = computed(() => categoryUses(recordsOnScreen))
const roles = knownRoles(installedPack().workbook?.categoryRoles ?? [])
const categories = computed(() => state.records?.categories ?? NO_RECORDS)
const saving = computed(() => writes.busy.value || state.writing)

type MadeCategories = readonly { readonly saved: number | null; readonly record: CategoryRecord }[]

/** A save of the categories that waits on the fill offer, with the rows it may fill. */
const filling = ref<{ readonly made: MadeCategories; readonly fills: readonly ShareFill[] } | null>(null)
const fillOpen = ref(false)

/** A save that sets or changes a default first asks whether the rows of the category without a share take it too. */
function saveCategories(made: MadeCategories): void {
  const workbook = state.workbook
  const fills =
    workbook !== null && settings.value.ownerPayModule
      ? shareFillsOf(
          workbook,
          made.map((draft) => draft.record),
        )
      : []
  if (fills.length === 0) {
    writeCategories(made, [])
    return
  }
  filling.value = { made, fills }
  fillOpen.value = true
}

function answerFill(fill: boolean): void {
  const pending = filling.value
  fillOpen.value = false
  if (pending !== null) writeCategories(pending.made, fill ? pending.fills : [])
}

/** The categories and the rows a fill gives their new default, in one write with one Undo. */
function writeCategories(made: MadeCategories, fills: readonly ShareFill[]): void {
  const records = state.records
  const filled = fills.reduce((sum, fill) => sum + fill.targets.length, 0)
  void writes.write(
    'Categories saved',
    (unit) => {
      writeDrafts(unit.of(CATEGORY_WRITES), storedOf(categories.value), made)
      if (records !== null) fillShares(unit, records, fills)
    },
    {
      failedTitle: 'Not saved',
      ...(filled === 0 ? {} : { description: `${rowsInWords(filled, 'row', 'rows')} without a share took the new default.` }),
    },
  )
}
</script>

<template>
  <AppCard title="Categories" collapse-id="settings.categories" :summary="rowsInWords(storedCount(categories), 'category', 'categories')" :reveal="linked">
    <template #subtitle> The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category in use keeps its name and its row. </template>
    <CategoriesEditor :records="categories" :uses="categoriesInUse" :roles="roles" :shares="settings.ownerPayModule" :saving="saving" @save="saveCategories" />
  </AppCard>
  <ShareFillDialog v-if="filling" v-model:open="fillOpen" :fills="filling.fills" @answer="answerFill" />
</template>
