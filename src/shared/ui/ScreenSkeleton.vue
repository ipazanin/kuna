<!-- Stands in for a screen while its code loads: a heading, a row of tiles and a card. -->
<template>
  <div class="flex flex-col gap-6" aria-busy="true" aria-label="Loading the screen" data-testid="screen-skeleton">
    <div class="flex flex-col gap-2">
      <span class="skeleton h-8 w-48" />
      <span class="skeleton h-4 w-80 max-w-full" />
    </div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <span v-for="tile in 4" :key="tile" class="skeleton h-28" />
    </div>
    <span class="skeleton h-72" />
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
