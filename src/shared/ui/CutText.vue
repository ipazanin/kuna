<script setup lang="ts">
import { onUpdated, useTemplateRef } from 'vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { useCutText } from './cutText'

withDefaults(
  defineProps<{
    as?: 'span' | 'p' | 'dt' | 'dd' | 'th'
    /** One line cut with an ellipsis, or two lines and then an ellipsis. */
    lines?: 1 | 2
  }>(),
  { as: 'span', lines: 1 },
)

const element = useTemplateRef<HTMLElement>('element')
const { focusable, shown, fullText, measure, close } = useCutText(element)
onUpdated(measure)

function openChanged(open: boolean): void {
  if (!open) close()
}
</script>

<template>
  <component :is="as" ref="element" :class="lines === 1 ? 'truncate' : 'line-clamp-2'" :tabindex="focusable ? 0 : undefined" data-cut-text>
    <slot />
    <UTooltip v-if="shown && element !== null" :reference="element" :text="fullText" open disable-hoverable-content :content="{ side: 'top' }" @update:open="openChanged" />
  </component>
</template>
