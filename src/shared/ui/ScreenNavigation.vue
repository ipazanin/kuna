<script lang="ts">
export interface NavigationEntry {
  readonly to: string
  readonly label: string
  /** A Lucide icon name such as `i-lucide-wallet`. */
  readonly icon: string
}
</script>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  navigation: readonly NavigationEntry[]
}>()
</script>

<template>
  <nav aria-label="Screens">
    <ul class="flex flex-col gap-0.5">
      <li v-for="entry in navigation" :key="entry.to">
        <RouterLink :to="entry.to" class="nav-link" active-class="is-active">
          <UIcon :name="entry.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span>{{ entry.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.4375rem 0.75rem;
  border-radius: var(--radius-control);
  font-size: 0.875rem;
  color: var(--ink-muted);
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.nav-link:hover {
  color: var(--ink-strong);
  background: var(--surface-elevated);
}

.nav-link.is-active {
  color: var(--ink-strong);
  background: var(--accent-wash);
  font-weight: 500;
}

.nav-link.is-active::before {
  content: '';
  position: absolute;
  inset-block: 0.4375rem;
  inset-inline-start: 0;
  width: 2px;
  border-radius: 1px;
  background: var(--accent);
}

.nav-link.is-active :deep(svg) {
  color: var(--accent);
}
</style>
