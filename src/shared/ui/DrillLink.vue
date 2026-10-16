<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  /** Null when no row is behind the figure, which then shows as plain text. */
  to: RouteLocationRaw | null
  /** Accessible name when the visible text alone does not say what opens, such as a bare amount. */
  label?: string
}>()
</script>

<template>
  <RouterLink v-if="to !== null" :to="to" :aria-label="label" class="drill-link">
    <slot />
  </RouterLink>
  <span v-else><slot /></span>
</template>

<style scoped>
.drill-link {
  color: inherit;
  border-radius: 3px;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  transition:
    text-decoration-color 120ms ease,
    color 120ms ease;
}

.drill-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}

.drill-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  text-decoration-color: var(--accent);
}
</style>
