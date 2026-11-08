<script setup lang="ts">
import { computed } from 'vue'

import { useChatElement } from '../../../../../shared/ai/presentation/chatDock'
import type { ChatElementShape } from '../../../../../shared/ai/presentation/chatDock'
import { figureAsked } from './figureAsk'
import type { AskableDetail } from './tracedFigureView'

/**
 * Lets the element around a build-up amount ask the chat about the figure. It renders only its slot, which gets `ask`
 * and `askLabel` for an `AskChatButton`, and `marked` for the row, tile or cell that takes the highlight while the chat is
 * about it. With no figure, as on a row with nothing to open, `askLabel` is null and `marked` empty.
 */
const props = withDefaults(
  defineProps<{
    detail: AskableDetail | null
    shape?: ChatElementShape
  }>(),
  { shape: 'row' },
)

const asked = computed(() => (props.detail === null ? null : figureAsked(props.detail)))
const { ask, marked } = useChatElement(asked, props.shape)
const markedElement = computed(() => (asked.value === null ? {} : { ...marked.value, 'data-figure-ask': '' }))
</script>

<template>
  <slot :ask="ask" :ask-label="asked?.label ?? null" :marked="markedElement" />
</template>
