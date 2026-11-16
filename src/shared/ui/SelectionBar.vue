<script setup lang="ts">
import { useTemplateRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { useStickyBandPart } from '../layout/stickyBand'
import { plural } from '../text/translation'
import { words } from './words'

/** The bar that stays in reach while rows are being picked: how many are picked, Pick all where a list offers it, the actions on them, and Cancel, which ends the picking. On a phone Cancel shrinks to its cross so Pick all shares the count's line, and the actions wrap under them. It sticks under the tab row where that sticks too, as on a phone. */
withDefaults(
  defineProps<{
    count: number
    /** Whether every row that can be picked is picked, or null for a list that offers no Pick all. */
    allPicked?: boolean | null
  }>(),
  { allPicked: null },
)

const emit = defineEmits<{ cancel: []; pickAll: [] }>()

useStickyBandPart(useTemplateRef<HTMLElement>('bar'))
</script>

<template>
  <div
    ref="bar"
    class="sticky top-[calc(var(--top-bar-height)+var(--page-tab-row,0px))] z-control flex flex-wrap items-center gap-2 border-b border-default bg-page/85 px-4 py-2.5 backdrop-blur-md sm:px-5"
    role="toolbar"
    :aria-label="plural(words.selection.picked(count), count)"
    data-testid="selection-bar"
  >
    <p class="flex-1 type-body whitespace-nowrap text-highlighted" aria-live="polite" data-testid="selection-bar-count">{{ plural(words.selection.picked(count), count) }}</p>
    <UButton
      v-if="allPicked !== null"
      :label="words.selection.pickAll"
      icon="i-lucide-list-checks"
      color="neutral"
      variant="outline"
      :disabled="allPicked"
      data-testid="selection-bar-pick-all"
      @click="emit('pickAll')"
    />
    <div class="order-last flex basis-full flex-wrap gap-2 sm:order-none sm:basis-auto sm:justify-end">
      <slot />
    </div>
    <UButton icon="i-lucide-x" color="neutral" variant="ghost" :ui="{ leadingIcon: 'sm:hidden' }" data-testid="selection-bar-cancel" @click="emit('cancel')">
      <span class="max-sm:sr-only">{{ words.selection.cancel }}</span>
    </UButton>
  </div>
</template>
