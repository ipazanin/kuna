<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { moveToItems } from '../../entries/application/rowRecords'
import { SPENDING_OVERVIEW_ROUTE } from '../../overview/presentation/spendingLinks'
import { useSpendingBooks } from '../application/spendingStore'
import { isBeforeItems, moveBlockers } from '../domain/beforeItems'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** Offers, while the file stores entries the way older versions of Kuna did, to update it in one write with Undo, or says what to fix first. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const book = computed(() => store.state.workbook)
const offered = computed(() => book.value !== null && isBeforeItems(book.value.stored))
const blockers = computed(() => (book.value === null ? { leftOut: 0, splitLegs: 0 } : moveBlockers(book.value)))
const blocking = computed(() => blockers.value.leftOut + blockers.value.splitLegs)
const blockedDescription = computed(() =>
  [
    ...(blockers.value.leftOut > 0 ? [plural(words.move.leftOut(blockers.value.leftOut), blockers.value.leftOut)] : []),
    ...(blockers.value.splitLegs > 0 ? [plural(words.move.splitLegs(blockers.value.splitLegs), blockers.value.splitLegs)] : []),
    words.move.blockedFix,
  ].join(' '),
)

function move(): void {
  const current = book.value
  if (current === null) return
  void writes.write(words.move.moved, (unit) => moveToItems(unit, current), { failedTitle: words.move.notMoved, key: 'move-to-items' })
}
</script>

<template>
  <UAlert
    v-if="offered && blocking > 0"
    icon="i-lucide-triangle-alert"
    color="warning"
    variant="subtle"
    :title="plural(words.move.blocked(blocking), blocking)"
    :description="blockedDescription"
    :actions="[{ label: words.move.openOverview, icon: 'i-lucide-arrow-right', color: 'neutral', variant: 'outline', size: 'sm', to: SPENDING_OVERVIEW_ROUTE }]"
    data-testid="spending-items-move-blocked"
  />
  <UAlert
    v-else-if="offered"
    icon="i-lucide-split"
    color="info"
    variant="subtle"
    :title="words.move.title"
    :description="words.move.description"
    :actions="[
      {
        label: words.move.action,
        icon: 'i-lucide-split',
        color: 'neutral',
        variant: 'outline',
        size: 'sm',
        loading: writes.saving('move-to-items'),
        disabled: writes.busy.value || writes.refused.value,
        onClick: move,
      },
    ]"
    data-testid="spending-items-move"
  />
</template>
