<script setup lang="ts">
/** One row of a list: what it is, its amount in a column of its own beside the title, and the lines under it running on under the amount. A row that asks something of a person offers its actions underneath, a control that acts on the row's words, such as Copy, sits beside them, and a row that opens a page ends with an arrow on the title's line. In a `row-list` with such a row, a row that opens nothing leaves the arrow's column empty. While rows are being picked, the row is a checkbox as a whole and hides its actions and its trailing control. */
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
  /** Whether the row is one of the lines under the row before it, such as an entry of a shared cost, which reads in caption size, sits closer and starts its words under that row's title past its lead. While rows are being picked, one that is also unpickable keeps the box's room but shows no box. */
  nested?: boolean
} & (
  | {
      /** The element, `li` when left out. */
      as?: 'li' | 'div'
      to?: never
      /** Whether a tap on the row opens it, emitting `open`, while its trailing control stays its own. It then takes no actions underneath. */
      opens?: boolean
      /** Whether the row is picked while rows are being picked, or null while it is not being picked. */
      picked?: boolean | null
      /** Whether the row cannot be picked while the others can, so its box stays dashed and a tap does nothing. */
      unpickable?: boolean
    }
  | {
      /** A row that opens or expands as a whole, which then takes no actions underneath and cannot be picked, since its pick box would be a button inside a button. */
      as: 'button'
      to?: never
      opens?: never
      picked?: never
      unpickable?: never
    }
  | {
      as?: never
      /** The page the whole row opens, which then takes no actions underneath. */
      to: RouteLocationRaw
      opens?: never
      picked?: never
      unpickable?: never
    }
)

const props = withDefaults(defineProps<RowProps>(), { caption: '', quiet: false, flush: false, nested: false, opens: false, picked: null, unpickable: false })
const emit = defineEmits<{ pick: []; open: [] }>()
const slots = defineSlots<{
  caption?: () => unknown
  details?: () => unknown
  amount?: () => unknown
  /** A dot-sized mark before the title on its first line, such as a category's dot. */
  lead?: () => unknown
  /** A control at the end of the row, beside its words: on the title's line in a row that `opens`, such as an entry's receipt camera, and centred against the words in a plain row, such as a Copy button beside a value. A row that opens a page or is a button takes none. */
  trailing?: () => unknown
  default?: () => unknown
}>()

const picking = computed(() => props.picked !== null)
/** Whether the row's words sit in a button of their own inside the row, which a tap on them presses. */
const pressable = computed(() => picking.value || props.opens)
/** Whether the row stands out of the picking, as the lines under a row that cannot be picked either: no box shows and the row is no checkbox. */
const outOfPicking = computed(() => picking.value && props.nested && props.unpickable)
const gutter = computed(() => {
  if (props.nested) return props.flush ? 'ps-5.5' : 'ps-9.5 pe-4 sm:ps-10.5 sm:pe-5'
  return props.flush ? '' : 'px-4 sm:px-5'
})
const height = computed(() => (props.nested ? 'py-1.5' : 'py-3'))
const titleLook = computed(() => (props.nested ? 'type-caption' : props.quiet ? 'type-aside' : 'type-row-title'))

/** Whether the row draws a trailing control, which a link or a button row cannot hold and picking hides. A function, since a slot's presence is not reactive. */
function trails(): boolean {
  return slots.trailing !== undefined && props.to === undefined && props.as !== 'button' && !picking.value
}

function press(): void {
  if (picking.value) {
    if (!props.unpickable) emit('pick')
  } else emit('open')
}
</script>

<template>
  <component
    :is="to === undefined ? (as ?? 'li') : RouterLink"
    v-bind="to === undefined ? { type: as === 'button' ? 'button' : undefined } : { to }"
    class="flex"
    :class="[
      to !== undefined ? 'items-start gap-3' : pressable ? '' : 'flex-col gap-2',
      pressable ? '' : [height, gutter],
      { 'w-full text-start': as === 'button', 'focus-inset transition-colors not-disabled:hover:bg-elevated disabled:cursor-not-allowed': as === 'button' || to !== undefined },
      { 'transition-colors not-data-chat-tagged:hover:bg-elevated': opens && !picking },
    ]"
  >
    <span :class="pressable ? 'list-row-frame flex min-w-0 flex-1 items-start' : trails() ? 'list-row-frame flex min-w-0 items-center gap-3' : 'contents'">
      <component
        :is="pressable ? 'button' : 'span'"
        v-bind="
          outOfPicking
            ? { type: 'button', disabled: true }
            : picking
              ? { type: 'button', role: 'checkbox', 'aria-checked': picked === true, disabled: unpickable, 'data-testid': 'list-row-pick' }
              : pressable
                ? { type: 'button' }
                : {}
        "
        class="flex items-start gap-3"
        :class="[
          pressable ? ['focus-inset min-w-0 flex-1 text-start', height, gutter] : to !== undefined || trails() ? 'min-w-0 flex-1' : '',
          { 'transition-colors not-disabled:hover:bg-elevated disabled:cursor-not-allowed max-sm:min-h-11': picking },
        ]"
        @click="pressable && press()"
      >
        <PickBox v-if="picking" :picked="picked === true" :unpickable="unpickable" :class="{ invisible: outOfPicking }" />
        <span v-if="$slots.lead" class="flex h-5 w-2.5 shrink-0 items-center" aria-hidden="true">
          <slot name="lead" />
        </span>
        <span class="list-row-lines min-w-0 flex-1">
          <span class="list-row-title break-words" :class="titleLook">{{ title }}</span>
          <span v-if="$slots.amount" class="list-row-amount" :class="nested ? 'text-xs' : 'text-sm'">
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
      <span v-if="trails()" class="flex shrink-0 items-center empty:hidden" :class="pressable ? ['me-2 sm:me-3', { 'mt-3 h-5': !nested }] : ''">
        <slot name="trailing" />
      </span>
    </span>
    <span v-if="to !== undefined" class="flex h-5 shrink-0 items-center" data-row-arrow>
      <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" aria-hidden="true" />
    </span>
    <slot v-if="to === undefined && !pressable" />
  </component>
</template>
