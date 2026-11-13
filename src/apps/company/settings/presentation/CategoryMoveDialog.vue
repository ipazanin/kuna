<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { listInWords } from '../../../../shared/text/listInWords'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { SlugUses } from '../../workbook/domain/slug'
import CategoryPicker from '../../transactions/presentation/CategoryPicker.vue'
import { categoryMoveOf, deleteCategoryInto, joinedInWords, keptInWords } from '../application/namedRecordWrites'
import type { KeptByMove } from '../domain/categoryMove'
import { useSettings } from '../application/useSettings'
import { words } from './words'

/** Deletes a category in use, its ledger rows, split parts, rules and the pack's records that name it moved to another in the same write, with one Undo. */
const props = defineProps<{
  category: CategoryRecord | null
  /** What names each category outside the tab. */
  uses: SlugUses
  /** What a move leaves naming each category, which keeps it until a person fixes those on their screen. */
  kept: ReadonlyMap<string, readonly KeptByMove[]>
}>()

const open = defineModel<boolean>('open', { required: true })

const DELETE_KEY = 'move-and-delete-category'

const store = useWorkbook()
const names = useDisplayNames()
const settings = useSettings()
const writes = useRecordWrites(store)
const into = ref<string | undefined>(undefined)

watch(
  () => props.category,
  () => {
    into.value = undefined
  },
)

const slug = computed(() => props.category?.slug ?? '')
const targets = computed(() => (store.state.workbook?.categories ?? []).filter((category) => category.slug !== slug.value))
const target = computed(() => targets.value.find((category) => category.slug === into.value) ?? null)
const kept = computed(() => keptInWords(props.kept.get(slug.value) ?? []))
const moving = computed(() => listInWords(props.uses.get(slug.value) ?? []))
const keptBy = computed(() => listInWords(kept.value.uses))
const fixedOn = computed(() => kept.value.places)
const joined = computed(() => {
  const records = store.state.records
  const workbook = store.state.workbook
  const to = target.value
  if (records === null || workbook === null || to === null || slug.value === '') return []
  return joinedInWords(categoryMoveOf(records, slug.value, to.slug, workbook.categories)).map((joined) => joined.text)
})
const bucketsMove = computed(() => {
  const from = props.category
  const to = target.value
  if (from === null || to === null || from.bucket === to.bucket) return null
  return words.categories.moveAndDelete.bucketsMove(settings.value.bucketLabels[from.bucket], settings.value.bucketLabels[to.bucket])
})

async function confirm(): Promise<void> {
  const category = props.category
  const records = store.state.records
  const workbook = store.state.workbook
  const targetSlug = target.value?.slug
  if (category === null || records === null || workbook === null || targetSlug === undefined || keptBy.value !== '') return
  const written = await writes.write(
    words.categories.moveAndDelete.deleted(names.value.category(category.slug), names.value.category(targetSlug)),
    (unit) => deleteCategoryInto(unit, records, category, targetSlug, workbook.categories),
    { key: DELETE_KEY, failedTitle: words.categories.moveAndDelete.notDeleted },
  )
  if (written) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="words.categories.moveAndDelete.title(category === null ? '' : names.category(category.slug))"
    :description="keptBy ? undefined : words.categories.moveAndDelete.savesAtOnce"
  >
    <UAlert v-if="keptBy" icon="i-lucide-triangle-alert" color="warning" variant="subtle" data-testid="category-move-kept">
      <template #description>{{ words.categories.moveAndDelete.kept(keptBy) }}</template>
      <template #actions>
        <UButton
          v-for="place in fixedOn"
          :key="place.label"
          :to="{ path: place.path, query: place.query }"
          :label="words.categories.moveAndDelete.open(place.label)"
          color="neutral"
          variant="outline"
          size="sm"
          data-testid="category-move-fix-on"
        />
      </template>
    </UAlert>
    <form v-else id="category-move" class="flex flex-col gap-4" data-testid="category-move" @submit.prevent="confirm">
      <UFormField :label="words.categories.moveAndDelete.into" :help="moving && words.categories.moveAndDelete.moves(moving)">
        <CategoryPicker v-model="into" :categories="targets" :placeholder="words.categories.moveAndDelete.pick" class="w-full" data-testid="category-move-into" />
      </UFormField>
      <UAlert v-for="sentence in joined" :key="sentence" icon="i-lucide-info" color="neutral" variant="subtle" :description="sentence" data-testid="category-move-joined" />
      <UAlert v-if="bucketsMove" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :description="bucketsMove" data-testid="category-move-buckets" />
    </form>
    <template #end>
      <template v-if="keptBy">
        <UButton :label="words.categories.moveAndDelete.close" color="neutral" variant="ghost" @click="open = false" />
      </template>
      <template v-else>
        <UButton :label="words.categories.moveAndDelete.cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          type="submit"
          form="category-move"
          :label="words.categories.moveAndDelete.confirm"
          icon="i-lucide-trash-2"
          color="error"
          :loading="writes.saving(DELETE_KEY)"
          :disabled="target === null || writes.refused.value"
          data-testid="confirm-category-move"
        />
      </template>
    </template>
  </AppDialog>
</template>
