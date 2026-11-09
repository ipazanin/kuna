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
    /** The element's name as the page shows it, which an icon-only button's name and the tooltip of a button without `text` hold. */
    label?: string
    /** An icon alone, for a dense row. Otherwise it reads "Ask the chat", or `text`. */
    iconOnly?: boolean
    /** The page's own name for what the chat does here, such as Suggest categories, in place of "Ask the chat". */
    text?: string | null
    /** The button's size, small beside a row's own controls, or the size of the step buttons it sits among. */
    size?: 'sm' | 'md'
    /** The action the button started is under way, so it spins and waits. */
    loading?: boolean
  }>(),
  { label: '', iconOnly: false, text: null, size: 'sm', loading: false },
)

const emit = defineEmits<{ ask: [] }>()
</script>

<template>
  <UButton
    v-if="assistKeyKept"
    v-bind="iconOnly ? { 'aria-label': words.ask.about(label) } : { label: text ?? words.ask.button }"
    icon="i-lucide-sparkles"
    color="neutral"
    :variant="iconOnly ? 'ghost' : 'outline'"
    :size="size"
    :title="text === null ? words.ask.about(label) : undefined"
    :loading="loading"
    data-testid="ask-chat"
    @click="emit('ask')"
  />
</template>
