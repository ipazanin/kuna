<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { TONE_ICONS, TONE_TEXT } from './toneText'
import type { Tone } from './toneText'

/** A short line of words after an icon, such as a warning under a row or why something was refused. */
const props = withDefaults(
  defineProps<{
    /** The ink of the icon, and of the words in a caption. Words in body size keep body ink. Left out, the line keeps its size's own ink. */
    tone?: Tone | 'muted' | undefined
    /** Left out, the tone's own icon: a triangle for a warning, a circle for an error or a success, and an i otherwise. */
    icon?: string | undefined
    size?: 'caption' | 'body'
    /** Whether the line flows on inside a sentence or a cell rather than taking a line of its own. */
    inline?: boolean
    as?: 'p' | 'li' | 'span' | 'div'
  }>(),
  { tone: undefined, icon: undefined, size: 'caption', inline: false, as: 'p' },
)

const shownIcon = computed(() => props.icon ?? (props.tone === undefined || props.tone === 'muted' ? 'i-lucide-info' : TONE_ICONS[props.tone]))
const ink = computed(() => (props.tone === undefined ? '' : props.tone === 'muted' ? 'text-muted' : TONE_TEXT[props.tone]))
</script>

<template>
  <component :is="as" class="min-w-0 items-start" :class="[inline ? 'inline-flex' : 'flex', size === 'body' ? 'gap-2 type-body' : ['gap-1.5 type-caption', ink]]">
    <UIcon :name="shownIcon" class="mt-0.5 shrink-0" :class="size === 'body' ? ['size-4', ink] : 'size-3.5'" aria-hidden="true" />
    <span class="min-w-0 flex-1 break-words"><slot /></span>
  </component>
</template>
