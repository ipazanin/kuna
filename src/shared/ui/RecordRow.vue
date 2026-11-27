<script setup lang="ts">
/**
 * A table row that stands for a record and opens it on a tap anywhere on the row, or a card in a list that stands in for
 * such a row on a phone. The link in its heading cell or its title stays the row's one link, so the keyboard, a screen
 * reader and Open in new tab use it. A record with no page opens in place, such as in its dialog, and its heading cell
 * holds a button that does the same. A control or a cell's own link inside the row works only itself, and a modified
 * click or a click that ends a text selection opens nothing.
 */
import { computed } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    /** The record the row opens, or null for a row that opens nothing, such as a total or a cash line. */
    to?: RouteLocationRaw | null
    /** Opens the record in place, such as a client in its dialog, in place of `to`. */
    open?: (() => void) | null
    /** `li` for a card in a list that stands in for the table's row where the table does not fit. */
    as?: 'tr' | 'li'
  }>(),
  { to: null, open: null, as: 'tr' },
)

const router = useRouter()

const opens = computed(() => props.to !== null || props.open !== null)

const CONTROLS =
  'a, button, input, select, textarea, label, summary, [contenteditable], [role="button"], [role="checkbox"], [role="combobox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]'

function openRecord(event: MouseEvent): void {
  if (!opens.value || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  // The path kept at dispatch still holds a control whose pressed part re-rendered away, such as a button's icon swapped for its spinner.
  const row = event.currentTarget
  if (row === null) return
  const path = event.composedPath()
  const inside = path.slice(0, path.indexOf(row))
  if (inside.some((node) => node instanceof Element && node.matches(CONTROLS))) return
  if ((window.getSelection()?.toString() ?? '') !== '') return
  if (props.open !== null) props.open()
  else if (props.to !== null) void router.push(props.to)
}
</script>

<template>
  <component :is="as" :data-record-row="opens ? '' : undefined" :class="{ 'cursor-pointer transition-colors hover:bg-elevated': opens }" @click="openRecord">
    <slot />
  </component>
</template>
