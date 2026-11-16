<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { TONE_ICONS, TONE_TEXT } from './toneText'
import type { Tone } from './toneText'

/** A short line of words after an icon, such as a warning under a row or why something was refused. */
const props = withDefaults(
  defineProps<{
    /** The ink of the icon, and of the words in a caption. Words in body size keep body ink, and in `inherit` the ink around them. Left out, the line keeps its size's own ink. */
    tone?: Tone | 'muted' | undefined
    /** Left out, the tone's own icon: a triangle for a warning, a circle for an error or a success, and an i otherwise. */
    icon?: string | undefined
    /** In `inherit` the line keeps the size and ink of where it sits, as a figure among other figures does, and only the icon takes the tone. */
    size?: 'caption' | 'body' | 'inherit'
    /** Whether the line flows on inside a sentence or a cell rather than taking a line of its own. */
    inline?: boolean
    as?: 'p' | 'li' | 'span' | 'div'
  }>(),
  { tone: undefined, icon: undefined, size: 'caption', inline: false, as: 'p' },
)

const shownIcon = computed(() => props.icon ?? (props.tone === undefined || props.tone === 'muted' ? 'i-lucide-info' : TONE_ICONS[props.tone]))
const ink = computed(() => (props.tone === undefined ? '' : props.tone === 'muted' ? 'text-muted' : TONE_TEXT[props.tone]))
const sized = computed(() => (props.size === 'caption' ? ['gap-1.5 type-caption', ink.value] : ['gap-2', props.size === 'body' ? 'type-body' : '']))
</script>

<template>
  <component :is="as" class="min-w-0 items-start" :class="[inline ? 'inline-flex' : 'flex', sized]">
    <UIcon :name="shownIcon" class="mt-0.5 shrink-0" :class="size === 'caption' ? 'size-3.5' : ['size-4', ink]" aria-hidden="true" />
    <span class="min-w-0 flex-1 break-words"><slot /></span>
  </component>
</template>
