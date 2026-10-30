<script setup lang="ts">
/** A scenario's letter in ink beside a short rule in its colour, or a dot on a muted rule while it is not compared. */
defineProps<{
  letter: string | null
  /** The colour token, such as `--scenario-2`, or null while the scenario is not compared. */
  colour: string | null
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-highlighted">
    <span class="swatch swatch-line h-0.75" :style="{ '--swatch': colour === null ? 'var(--border-strong)' : `var(${colour})` }" aria-hidden="true" />
    {{ letter ?? '·' }}
  </span>
</template>
