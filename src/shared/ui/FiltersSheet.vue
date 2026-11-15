<script setup lang="ts">
import { inject, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { PAGE_TAB_ACTIONS } from './PageTabs.vue'
import { words } from './words'

/**
 * A phone's Filters button with how many filters are on, opening a sheet from the bottom that holds the filters. Inside a
 * page's tabs the button sits at the right end of the tab row, and keeps only its icon and count when long tab labels leave no
 * room for its word.
 */
defineProps<{
  /** How many filters narrow the screen. */
  activeCount: number
  /** The sheet's closing button, named after what it shows, such as Show results. */
  showLabel: string
}>()

defineSlots<{ default: () => unknown }>()

const tabActions = inject(PAGE_TAB_ACTIONS, null)
const open = ref(false)
</script>

<template>
  <Teleport :to="tabActions?.to ?? 'body'" :disabled="tabActions === null" defer>
    <USlideover v-model:open="open" side="bottom" :title="words.filters" :ui="{ content: 'phone-sheet' }">
      <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" :class="{ 'ms-2': tabActions !== null }" data-testid="open-filters">
        <span :class="{ 'sr-only': tabActions?.crowded.value }" data-testid="filters-word">{{ words.filters }}</span>
        <UBadge v-if="activeCount > 0" :label="String(activeCount)" size="sm" class="rounded-full" data-testid="filter-count" />
        <span class="sr-only">{{ words.activeFilters(activeCount) }}</span>
      </UButton>
      <template #body>
        <slot />
      </template>
      <template #footer>
        <UButton :label="showLabel" block size="lg" data-testid="filters-show" @click="open = false" />
      </template>
    </USlideover>
  </Teleport>
</template>
