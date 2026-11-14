<script setup lang="ts">
/** One row of a list: what it is, its amount in a column of its own beside the title, and the lines under it running on under the amount. A row that asks something of a person offers its actions underneath, and a row that opens a page ends with an arrow on the title's line. */
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

type RowProps = {
  title: string
  caption?: string
  /** Whether the title reads quieter, as for a row that is already in the books. */
  quiet?: boolean
  /** Whether the row sits inside padding of its own, as in a card's body, rather than spanning the card with its gutter. */
  flush?: boolean
} & (
  | {
      /** The element, `li` when left out. A button is for a row that opens or expands as a whole, which then takes no actions underneath. */
      as?: 'li' | 'div' | 'button'
      to?: never
    }
  | {
      as?: never
      /** The page the whole row opens, which then takes no actions underneath. */
      to: RouteLocationRaw
    }
)

withDefaults(defineProps<RowProps>(), { caption: '', quiet: false, flush: false })
defineSlots<{ caption?: () => unknown; details?: () => unknown; amount?: () => unknown; default?: () => unknown }>()
</script>

<template>
  <component
    :is="to === undefined ? (as ?? 'li') : RouterLink"
    v-bind="to === undefined ? { type: as === 'button' ? 'button' : undefined } : { to }"
    class="flex py-3"
    :class="[
      to === undefined ? 'flex-col gap-2' : 'items-start gap-3',
      { 'px-4 sm:px-5': !flush, 'w-full text-start': as === 'button', 'transition-colors hover:bg-elevated focus-visible:-outline-offset-2': as === 'button' || to !== undefined },
    ]"
  >
    <span class="proposal-row-lines" :class="{ 'min-w-0 flex-1': to !== undefined }">
      <span class="proposal-row-title break-words text-sm" :class="quiet ? 'text-muted' : 'text-highlighted'">{{ title }}</span>
      <span v-if="$slots.amount" class="proposal-row-amount text-sm">
        <slot name="amount" />
      </span>
      <span v-if="caption !== '' || $slots.caption" class="proposal-row-caption break-words type-caption">
        <slot name="caption">{{ caption }}</slot>
      </span>
      <span v-if="$slots.details" class="proposal-row-details flex flex-col gap-0.5">
        <slot name="details" />
      </span>
    </span>
    <span v-if="to !== undefined" class="flex h-5 shrink-0 items-center" data-row-arrow>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" aria-hidden="true" />
    </span>
    <slot v-else />
  </component>
</template>
