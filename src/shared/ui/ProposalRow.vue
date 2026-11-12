<script setup lang="ts">
import { computed, useId } from 'vue'

/** One row of a list that asks something of a person: what it is, its amount in a column of its own beside the title, the lines under it running on under the amount, and the actions it offers underneath. */
const props = withDefaults(
  defineProps<{
    title: string
    caption?: string
    /** Whether the title reads quieter, as for a row that is already in the books. */
    quiet?: boolean
    /** Whether the row sits inside padding of its own, as in a card's body, rather than spanning the card with its gutter. */
    flush?: boolean
    /** A button for a row that opens or expands as a whole, which then takes no actions underneath. */
    as?: 'li' | 'div' | 'button'
  }>(),
  { caption: '', quiet: false, flush: false, as: 'li' },
)
defineSlots<{ details?: () => unknown; amount?: () => unknown; default?: () => unknown }>()

const id = useId()
/** The amount floats ahead of the title in the page, so a button names itself in reading order: what it is, then its amount, then the lines under it. */
const buttonName = computed(() => (props.as === 'button' ? `${id}-title ${id}-amount ${id}-caption ${id}-details` : undefined))
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    :aria-labelledby="buttonName"
    class="flex flex-col gap-2 py-3"
    :class="{ 'px-4 sm:px-5': !flush, 'w-full text-start': as === 'button' }"
  >
    <span class="flow-root">
      <span v-if="$slots.amount" :id="`${id}-amount`" class="float-end ms-3 flex flex-col items-end gap-0.5 text-end text-sm">
        <slot name="amount" />
      </span>
      <span :id="`${id}-title`" class="block break-words text-sm" :class="quiet ? 'text-muted' : 'text-highlighted'">{{ title }}</span>
      <span v-if="caption !== ''" :id="`${id}-caption`" class="mt-0.5 block break-words type-caption">{{ caption }}</span>
      <span v-if="$slots.details" :id="`${id}-details`" class="mt-0.5 flex flex-col gap-0.5">
        <slot name="details" />
      </span>
    </span>
    <slot />
  </component>
</template>
