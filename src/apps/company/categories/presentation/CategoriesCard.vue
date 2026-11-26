<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ruleCounts } from '../../../../shared/categorising/domain/rulesFiling'
import AppCard from '../../../../shared/ui/AppCard.vue'
import { NO_RECORDS, recordsOf, storedOf } from '../../../../shared/storage/domain/recordsRead'
import { fillShares } from '../../owner-share/application/ownerShareWrites'
import { shareFillsOf } from '../../owner-share/domain/ownerShare'
import type { ShareFill } from '../../owner-share/domain/ownerShare'
import ShareFillDialog from '../../owner-share/presentation/ShareFillDialog.vue'
import { classSharesDay, installedPack } from '../../packs/packContribution'
import { useSettings } from '../../settings/application/useSettings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { writeDrafts } from '../../workbook/application/draftWrites'
import { CATEGORY_WRITES, categoryKeptAfterMove, categoryUses } from '../application/categoryWrites'
import type { RecordsOfKind } from '../../settings/application/namedRecordWrites'
import { knownRoles } from '../domain/categoryGuards'
import CategoriesEditor from './CategoriesEditor.vue'
import CategoryMoveDialog from './CategoryMoveDialog.vue'
import { storedCount } from '../../workbook/presentation/storedCount'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import { ruleTargetsOf } from '../../rules/domain/ruleTargets'
import { rulesIntoCategoryLink, SORTING_CARDS } from '../../sorting/presentation/sortingLinks'

const { state } = useWorkbook()
const settings = useSettings()
const route = useRoute()
const rulesInto = computed(() => ruleCounts(state.workbook?.rules ?? [], ruleTargetsOf))
const writes = useRecordWrites(useWorkbook())

const recordsOnScreen: RecordsOfKind = (kind) => (state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, kind))
const categoriesInUse = computed(() => categoryUses(recordsOnScreen))
const keptAfterMove = computed(() => categoryKeptAfterMove(recordsOnScreen))
const roles = knownRoles(installedPack().workbook?.categoryRoles ?? [])
const classes = installedPack().workbook?.categoryClasses ?? []
const sharesOn = computed(() => classSharesDay(state.workbook))
const classHelp = (role: string) => installedPack().categoryClassHelp(role, sharesOn.value)
const categories = computed(() => state.records?.categories ?? NO_RECORDS)

const moved = ref<CategoryRecord | null>(null)
const moveOpen = ref(false)

function moveAndDelete(slug: string): void {
  moved.value = recordsOf(categories.value).find((category) => category.slug === slug) ?? null
  moveOpen.value = moved.value !== null
}

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
    words.categories.saved,
    (unit) => {
      writeDrafts(unit.of(CATEGORY_WRITES), storedOf(categories.value), made)
      if (records !== null) fillShares(unit, records, fills)
    },
    {
      failedTitle: words.categories.notSaved,
      ...(filled === 0 ? {} : { description: plural(words.categories.filled(filled), filled) }),
    },
  )
}
</script>

<template>
  <AppCard
    :id="SORTING_CARDS.categories"
    :title="words.categories.title"
    collapse-id="company-sorting.categories"
    :summary="plural(words.categories.count(storedCount(categories)), storedCount(categories))"
    start-collapsed
    :reveal="route.hash === `#${SORTING_CARDS.categories}`"
    data-testid="company-categories"
  >
    <template #subtitle>{{ classes.length > 0 ? `${words.categories.subtitle} ${words.categories.classesNote}` : words.categories.subtitle }}</template>
    <CategoriesEditor
      :records="categories"
      :uses="categoriesInUse"
      :roles="roles"
      :classes="classes"
      :class-help="classHelp"
      :shares="settings.ownerPayModule"
      :saving="writes.saving('save')"
      :refused="writes.refused.value"
      :rule-counts="rulesInto"
      :rules-link="rulesIntoCategoryLink"
      @save="saveCategories"
      @move-and-delete="moveAndDelete"
    />
  </AppCard>
  <CategoryMoveDialog v-model:open="moveOpen" :category="moved" :uses="categoriesInUse" :kept="keptAfterMove" />
  <ShareFillDialog v-if="filling" v-model:open="fillOpen" :fills="filling.fills" @answer="answerFill" />
</template>
