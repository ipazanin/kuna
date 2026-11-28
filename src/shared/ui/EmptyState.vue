<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'

import { TONE_ICONS } from './toneText'

/**
 * The card a screen or a part of it shows in place of what it has nothing of yet, dashed, or of what
 * could not be worked out, with an error edge and the error icon. The description and actions slots take richer content.
 * With `line` it is the one quiet sentence an empty list shows in its card, at the card's body padding.
 * Its default slot then takes a sentence with a link in it.
 */
defineProps<
  | {
      line?: false
      icon: string
      title: string
      description?: string | undefined
      actions?: readonly ButtonProps[]
      tone?: 'empty'
    }
  | {
      line?: false
      icon?: never
      title: string
      description?: string | undefined
      actions?: readonly ButtonProps[]
      tone: 'error'
    }
  | {
      line: true
      title?: string
    }
>()
</script>

<template>
  <p v-if="line" class="px-4 pt-3 pb-4 type-aside sm:px-5" data-empty-state>
    <slot>{{ title }}</slot>
  </p>
  <UEmpty
    v-else
    data-empty-state
    :icon="tone === 'error' ? TONE_ICONS.error : icon"
    :title="title"
    v-bind="description === undefined ? {} : { description }"
    :actions="actions ? [...actions] : []"
    variant="naked"
    :class="tone === 'error' ? 'rounded-card border border-error bg-raised' : 'rounded-card border border-dashed border-accented bg-raised/40'"
    :avatar="{ color: tone === 'error' ? 'error' : 'neutral' }"
  >
    <template v-if="$slots.description" #description>
      <slot name="description" />
    </template>
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </UEmpty>
</template>
