<script setup lang="ts">
import { ref } from 'vue'

import AppCard from '../../shared/ui/AppCard.vue'
import MoveButtons from '../../shared/ui/MoveButtons.vue'

const order = ref(['Groceries', 'Fuel', 'Eating out'])

/** Swaps a row with its neighbour, as a list's move up and move down do. */
function moveRow(place: number, step: -1 | 1): void {
  const moved = [...order.value]
  const [moving] = moved.splice(place, 1)
  if (moving !== undefined) moved.splice(place + step, 0, moving)
  order.value = moved
}
</script>

<template>
  <AppCard
    title="MoveButtons"
    subtitle="Moves a row of an ordered list one place up or down, off at either end, 44 px on a phone. The second row's write runs, and the last list takes no moves, as while the file is read-only."
  >
    <ol class="flex flex-col px-4 pt-1 pb-3 sm:px-5" data-testid="gallery-move-buttons">
      <li v-for="(name, place) in order" :key="name" class="flex items-center gap-2 border-b border-default last:border-b-0">
        <span class="min-w-0 flex-1 py-2 break-words type-row-title">{{ name }}</span>
        <MoveButtons
          :up-label="`Move ${name} up`"
          :down-label="`Move ${name} down`"
          :first="place === 0"
          :last="place === order.length - 1"
          :saving="place === 1 ? 'down' : null"
          @up="moveRow(place, -1)"
          @down="moveRow(place, 1)"
        />
      </li>
    </ol>
    <ol class="flex flex-col border-t border-default px-4 pt-1 pb-3 sm:px-5" data-testid="gallery-move-buttons-disabled">
      <li v-for="(name, place) in order" :key="name" class="flex items-center gap-2 border-b border-default last:border-b-0">
        <span class="min-w-0 flex-1 py-2 break-words type-row-title">{{ name }}</span>
        <MoveButtons :up-label="`Move ${name} up`" :down-label="`Move ${name} down`" :first="place === 0" :last="place === order.length - 1" disabled />
      </li>
    </ol>
  </AppCard>
</template>
