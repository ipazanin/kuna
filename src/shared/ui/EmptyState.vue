<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'

/**
 * The card a screen or a part of it shows in place of what it has nothing of yet, dashed, or of what
 * could not be worked out, with an error edge and icon. The description and actions slots take richer content.
 */
withDefaults(
  defineProps<{
    icon: string
    title: string
    description?: string | undefined
    actions?: readonly ButtonProps[]
    tone?: 'empty' | 'error'
  }>(),
  { tone: 'empty' },
)
</script>

<template>
  <UEmpty
    :icon="icon"
    :title="title"
    v-bind="description === undefined ? {} : { description }"
    :actions="actions ? [...actions] : []"
    variant="outline"
    :class="tone === 'error' ? 'rounded-card border-error/40 bg-raised' : 'rounded-card border-dashed bg-raised/40'"
    :ui="tone === 'error' ? { avatar: 'text-error' } : {}"
  >
    <template v-if="$slots.description" #description>
      <slot name="description" />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </UEmpty>
</template>
