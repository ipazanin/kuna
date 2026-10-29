<script setup lang="ts">
import { words } from '../app/words'

/** Stands in for a screen while its code or its books load: a heading, a row of tiles and its cards. */
withDefaults(
  defineProps<{
    /** False when the screen's own header already shows. */
    heading?: boolean
    cards?: number
  }>(),
  { heading: true, cards: 1 },
)
</script>

<template>
  <div class="flex flex-col gap-6" aria-busy="true" :aria-label="words.loadingScreen" data-testid="screen-skeleton">
    <div v-if="heading" class="flex flex-col gap-2">
      <span class="skeleton h-8 w-48" />
      <span class="skeleton h-4 w-80 max-w-full" />
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <span v-for="tile in 4" :key="tile" class="skeleton h-28" />
    </div>
    <div class="grid gap-4 xl:grid-cols-2">
      <span v-for="card in cards" :key="card" class="skeleton h-72" />
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  display: block;
  border-radius: var(--radius-card);
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 1px var(--border-default);
}

@media (prefers-reduced-motion: no-preference) {
  .skeleton {
    animation: breathe 1.6s ease-in-out infinite;
  }
}

@keyframes breathe {
  50% {
    opacity: 0.55;
  }
}
</style>
