<script setup lang="ts">
/** One row of a list that asks something of a person: what it is, its amount in a column of its own beside the title, the lines under it running on under the amount, and the actions it offers underneath. */
withDefaults(
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
</script>

<template>
  <component :is="as" :type="as === 'button' ? 'button' : undefined" class="flex flex-col gap-2 py-3" :class="{ 'px-4 sm:px-5': !flush, 'w-full text-start': as === 'button' }">
    <span class="flow-root">
      <span v-if="$slots.amount" class="float-end ms-3 flex flex-col items-end gap-0.5 text-end text-sm">
        <slot name="amount" />
      </span>
      <span class="block break-words text-sm" :class="quiet ? 'text-muted' : 'text-highlighted'">{{ title }}</span>
      <span v-if="caption !== ''" class="mt-0.5 block break-words type-caption">{{ caption }}</span>
      <span v-if="$slots.details" class="mt-0.5 flex flex-col gap-0.5">
        <slot name="details" />
      </span>
    </span>
    <slot />
  </component>
</template>
