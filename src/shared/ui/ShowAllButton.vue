<script lang="ts">
/** How many entries a long list shows before "Show all". */
export const FIRST_SHOWN = 10
</script>

<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'

/** The foot of a long list that shows its first ten entries, with the button that shows the rest. */
defineProps<{
  /** Every entry of the list. */
  total: number
}>()

const expanded = defineModel<boolean>('expanded', { required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
    <UButton
      :label="expanded ? words.showFewer : words.showAll(total)"
      :trailing-icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="outline"
      size="sm"
      :aria-expanded="expanded"
      data-testid="show-all"
      @click="expanded = !expanded"
    />
    <span v-if="!expanded" class="figure text-xs text-muted">{{ words.shownOf(FIRST_SHOWN, total) }}</span>
  </div>
</template>
