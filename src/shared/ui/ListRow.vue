<script setup lang="ts">
/** One row of a list: what it is, its amount in a column of its own beside the title, and the lines under it running on under the amount. A row that asks something of a person offers its actions underneath, and a row that opens a page ends with an arrow on the title's line. In a `row-list` with such a row, a row that opens nothing leaves the arrow's column empty. While rows are being picked, the row is a checkbox as a whole and hides its actions. */
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

import PickBox from './PickBox.vue'

type RowProps = {
  title: string
  caption?: string
  /** Whether the title reads quieter, as for a row that is already in the books. */
  quiet?: boolean
  /** Whether the row sits inside padding of its own, as in a card's body, rather than spanning the card with its gutter. */
  flush?: boolean
} & (
  | {
      /** The element, `li` when left out. */
      as?: 'li' | 'div'
      to?: never
      /** Whether the row is picked while rows are being picked, or null while it is not being picked. */
      picked?: boolean | null
      /** Whether the row cannot be picked while the others can, so its box stays dashed and a tap does nothing. */
      unpickable?: boolean
    }
  | {
      /** A row that opens or expands as a whole, which then takes no actions underneath and cannot be picked, since its pick box would be a button inside a button. */
      as: 'button'
      to?: never
      picked?: never
      unpickable?: never
    }
  | {
      as?: never
      /** The page the whole row opens, which then takes no actions underneath. */
      to: RouteLocationRaw
      picked?: never
      unpickable?: never
    }
)

const props = withDefaults(defineProps<RowProps>(), { caption: '', quiet: false, flush: false, picked: null, unpickable: false })
const emit = defineEmits<{ pick: [] }>()
defineSlots<{ caption?: () => unknown; details?: () => unknown; amount?: () => unknown; default?: () => unknown }>()

const picking = computed(() => props.picked !== null)
const gutter = computed(() => (props.flush ? '' : 'px-4 sm:px-5'))
</script>

<template>
  <component
    :is="to === undefined ? (as ?? 'li') : RouterLink"
    v-bind="to === undefined ? { type: as === 'button' ? 'button' : undefined } : { to }"
    class="flex"
    :class="[
      to === undefined ? 'flex-col gap-2' : 'items-start gap-3',
      picking ? '' : ['py-3', gutter],
      { 'w-full text-start': as === 'button', 'transition-colors not-disabled:hover:bg-elevated disabled:cursor-not-allowed focus-visible:-outline-offset-2': as === 'button' || to !== undefined },
    ]"
  >
    <component
      :is="picking ? 'button' : 'span'"
      v-bind="picking ? { type: 'button', role: 'checkbox', 'aria-checked': picked === true, disabled: unpickable, 'data-testid': 'list-row-pick' } : {}"
      :class="
        picking ? ['flex w-full items-start gap-3 py-3 text-start transition-colors focus-visible:-outline-offset-2 not-disabled:hover:bg-elevated disabled:cursor-not-allowed', gutter] : 'contents'
      "
      @click="picking && !unpickable && emit('pick')"
    >
      <PickBox v-if="picking" :picked="picked === true" :unpickable="unpickable" />
      <span class="list-row-lines" :class="{ 'min-w-0 flex-1': to !== undefined || picking }">
        <span class="list-row-title break-words" :class="quiet ? 'type-aside' : 'type-row-title'">{{ title }}</span>
        <span v-if="$slots.amount" class="list-row-amount text-sm">
          <slot name="amount" />
        </span>
        <span v-if="caption !== '' || $slots.caption" class="list-row-caption break-words type-caption">
          <slot name="caption">{{ caption }}</slot>
        </span>
        <span v-if="$slots.details" class="list-row-details flex flex-col gap-0.5">
          <slot name="details" />
        </span>
      </span>
    </component>
    <span v-if="to !== undefined" class="flex h-5 shrink-0 items-center" data-row-arrow>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" aria-hidden="true" />
    </span>
    <slot v-else-if="!picking" />
  </component>
</template>
