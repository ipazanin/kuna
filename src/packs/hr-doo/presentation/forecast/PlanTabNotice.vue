<script setup lang="ts">
/** Says, before a plan dialog saves, that the write adds the plan tab to a Google Sheet without one. */
defineProps<{
  headers: string
}>()
</script>

<template>
  <div class="rounded-[var(--radius-control)] border border-default px-3 py-2 text-sm text-toned" data-testid="add-tab-notice">
    The Sheet has no plan tab. Saving adds a tab named <span class="identifier">plan</span> with the headers <span class="identifier">{{ headers }}</span> in row 1, then
    writes the rows below them. Nothing else in the Sheet changes.
  </div>
</template>
