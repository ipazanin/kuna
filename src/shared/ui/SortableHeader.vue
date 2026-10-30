<script lang="ts">
export type SortDirection = 'ascending' | 'descending'
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { words } from './words'

/**
 * The header cell of a plain table's column that sorts. A press sorts ascending, the next
 * descending, and the third goes back to the table's own order.
 */
defineProps<{
  label: string
}>()

/** Null while the table is not sorted by this column. */
const direction = defineModel<SortDirection | null>({ required: true })

const icon = computed(() => (direction.value === 'ascending' ? 'i-lucide-arrow-up' : direction.value === 'descending' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down'))

function press(): void {
  direction.value = direction.value === null ? 'ascending' : direction.value === 'ascending' ? 'descending' : null
}
</script>

<template>
  <th scope="col" class="text-start" :aria-sort="direction ?? undefined">
    <UButton
      :label="label"
      color="neutral"
      variant="ghost"
      size="xs"
      class="-mx-2 font-medium"
      :class="direction === null ? 'text-muted' : 'text-highlighted'"
      :trailing-icon="icon"
      :aria-label="words.sortBy(label)"
      data-testid="sort-column"
      @click="press"
    />
  </th>
</template>
