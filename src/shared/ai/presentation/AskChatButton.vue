<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { assistKeyKept } from './aiProvider'
import { words } from './words'

/**
 * Opens the chat about one element of a page, which `useChatElement` gives as `ask`. It shows only while a key is kept,
 * as the chat does. A page asks, never a dialog, so this button sits on the page.
 */
withDefaults(
  defineProps<{
    /** The element's name as the page shows it, which the button's name for a screen reader holds. */
    label: string
    /** An icon alone, for a dense row. Otherwise it reads "Ask the chat", or `text`. */
    iconOnly?: boolean
    /** The page's own name for what the chat does here, such as Suggest categories, in place of "Ask the chat". */
    text?: string | null
  }>(),
  { iconOnly: false, text: null },
)

const emit = defineEmits<{ ask: [] }>()
</script>

<template>
  <UButton
    v-if="assistKeyKept"
    v-bind="iconOnly ? {} : { label: text ?? words.ask.button }"
    icon="i-lucide-sparkles"
    color="neutral"
    :variant="iconOnly ? 'ghost' : 'outline'"
    size="sm"
    :aria-label="text ?? words.ask.about(label)"
    :title="words.ask.about(label)"
    data-testid="ask-chat"
    @click="emit('ask')"
  />
</template>
