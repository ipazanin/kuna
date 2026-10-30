<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'

import { words } from './words'

/** An info button with a definition, or with what the default slot holds, such as a legend. */
defineProps<{
  /** What the definition is about, read out as "About {subject}". */
  subject: string
  definition?: string
}>()
</script>

<template>
  <UPopover :content="{ side: 'top', align: 'end', collisionPadding: 12 }">
    <UButton icon="i-lucide-info" color="neutral" variant="ghost" size="xs" :aria-label="words.about(subject)" class="text-muted hover:text-highlighted" />
    <template #content>
      <slot>
        <p class="max-w-72 p-3 text-sm leading-relaxed text-toned">{{ definition }}</p>
      </slot>
    </template>
  </UPopover>
</template>
