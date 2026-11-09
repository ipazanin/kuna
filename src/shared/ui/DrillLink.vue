<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

withDefaults(
  defineProps<{
    /** Null when no row is behind the figure, which then shows as plain text. */
    to: RouteLocationRaw | null
    /** Accessible name when the visible text alone does not say what opens, such as a bare amount. */
    label?: string
    /** A link in the middle of a sentence. On a phone it makes its own line 44 px tall and is underlined. A link that ends a sentence goes on its own line with `inline-target` instead. */
    inProse?: boolean
  }>(),
  { inProse: false },
)
</script>

<template>
  <RouterLink v-if="to !== null" :to="to" :aria-label="label" class="drill-link" :class="{ 'in-prose': inProse }">
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

/* On a phone the figure is a tap target, so the link takes the 44 px height app.css sets. */
@media (max-width: 639px) {
  .drill-link:not(.in-prose, .inline-target) {
    display: inline-flex;
    max-width: 100%;
    align-items: center;
  }

  /* In a sentence the link stays on the text's baseline and is 44 px tall, which only the lines holding a link grow to. */
  .drill-link.in-prose {
    display: inline-block;
    line-height: 44px;
    white-space: nowrap;
    text-decoration-color: currentcolor;
  }
}
</style>
