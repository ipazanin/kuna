<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import { itemsMoveBlockers, moveToItems } from '../application/rowIdWrites'
import { useDisplayNames } from '../application/useDisplayNames'
import { useWorkbook } from '../application/workbookStore'
import { storesItems } from '../domain/rowItems'
import { itemsMoveBlockerLines } from './itemsMoveBlockers'
import { words } from './words'
import { TONE_ICONS } from '../../../../shared/ui/toneText'

/** Offers, while the books keep categories the way older versions of Kuna did, to move them to items in one write with Undo, or names what to fix first. */
const store = useWorkbook()
const { state } = store
const writes = useRecordWrites(store)
const names = useDisplayNames()

const books = computed(() => (state.records === null || state.workbook === null ? null : { records: state.records, workbook: state.workbook }))
const offered = computed(() => books.value !== null && !storesItems(books.value.records))
const blockers = computed(() => (books.value === null ? [] : itemsMoveBlockers(books.value)))
const blockerLines = computed(() => itemsMoveBlockerLines(blockers.value, names.value.account))

function move(): void {
  const current = books.value
  if (current === null) return
  void writes.write(words.itemsMove.moved, (unit) => moveToItems(unit, current), { failedTitle: words.itemsMove.notMoved, key: 'move-to-items' })
}
</script>

<template>
  <UAlert
    v-if="offered && blockers.length > 0"
    :icon="TONE_ICONS.warning"
    color="warning"
    variant="subtle"
    :title="plural(words.itemsMove.blocked(blockers.length), blockers.length)"
    data-testid="company-items-move-blocked"
  >
    <template #description>
      <ul class="flex list-disc flex-col gap-1 ps-4">
        <li v-for="(line, at) in blockerLines" :key="at" :data-count="line.count">{{ line.text }}</li>
      </ul>
      <p class="mt-2">{{ words.itemsMove.blockedFix }}</p>
    </template>
  </UAlert>
  <UAlert
    v-else-if="offered"
    icon="i-lucide-split"
    color="info"
    variant="subtle"
    :title="words.itemsMove.title"
    :description="words.itemsMove.description"
    :actions="[
      {
        label: words.itemsMove.action,
        icon: 'i-lucide-split',
        color: 'neutral',
        variant: 'outline',
        size: 'sm',
        loading: writes.saving('move-to-items'),
        disabled: writes.busy.value || writes.refused.value,
        onClick: move,
      },
    ]"
    data-testid="company-items-move"
  />
</template>
