<script setup lang="ts">
import { useTemplateRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { useStickyBandPart } from '../../../../shared/layout/stickyBand'

/** The bar that stays in reach while rows are being selected: how many are picked, the actions on them, and Cancel, which ends the selection. It sticks under the tab row where that sticks too, as on a phone. */
defineProps<{
  /** How many rows are picked, in words, such as "3 picked". */
  summary: string
  cancelLabel: string
}>()

const emit = defineEmits<{ cancel: [] }>()

useStickyBandPart(useTemplateRef<HTMLElement>('bar'))
</script>

<template>
  <div
    ref="bar"
    class="sticky top-[calc(var(--top-bar-height)+var(--page-tab-row,0px))] z-control flex flex-wrap items-center gap-2 border-b border-default bg-page/85 px-4 py-2.5 backdrop-blur-md sm:px-5"
    role="toolbar"
    :aria-label="summary"
    data-testid="selection-bar"
  >
    <p class="flex-1 type-body whitespace-nowrap text-highlighted" aria-live="polite" data-testid="selection-bar-count">{{ summary }}</p>
    <div class="ms-auto flex gap-2">
      <slot />
      <UButton :label="cancelLabel" color="neutral" variant="ghost" data-testid="selection-bar-cancel" @click="emit('cancel')" />
    </div>
  </div>
</template>
