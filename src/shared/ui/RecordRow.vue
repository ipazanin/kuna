<script setup lang="ts">
/**
 * A table row that stands for a record and opens it on a tap anywhere on the row. The link in its heading cell stays the
 * row's one link, so the keyboard, a screen reader and Open in new tab use it. A control or a cell's own link inside the
 * row works only itself, and a modified click or a click that ends a text selection opens nothing.
 */
import { useRouter, type RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  /** The record the row opens, or null for a row that opens nothing, such as a total or a cash line. */
  to: RouteLocationRaw | null
}>()

const router = useRouter()

const CONTROLS =
  'a, button, input, select, textarea, label, summary, [contenteditable], [role="button"], [role="checkbox"], [role="combobox"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]'

function openRecord(event: MouseEvent): void {
  if (props.to === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const row = event.currentTarget
  const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null
  if (control !== null && row instanceof Element && row.contains(control)) return
  if ((window.getSelection()?.toString() ?? '') !== '') return
  void router.push(props.to)
}
</script>

<template>
  <tr :data-record-row="to === null ? undefined : ''" :class="{ 'cursor-pointer transition-colors hover:bg-elevated': to !== null }" @click="openRecord">
    <slot />
  </tr>
</template>
