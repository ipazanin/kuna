<script setup lang="ts">
/**
 * A table of figures in a card, styled by `.data-table`: hairline rows, muted headings, cells on one
 * line unless marked `cell-wraps`. Its frame is the container that `@md:table-cell` and the like
 * answer to, and it scrolls sideways only when the table cannot fit.
 */
defineProps<{
  /** What a screen reader calls the table, when no heading or caption names it. */
  label?: string
}>()
</script>

<template>
  <div class="@container relative overflow-x-auto">
    <table class="data-table w-full text-sm" :aria-label="label">
      <slot />
    </table>
  </div>
</template>
