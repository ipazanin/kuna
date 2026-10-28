<script lang="ts">
export interface NavigationEntry {
  readonly to: string
  /** Its name in the menu, such as Overview. */
  readonly label: string
  /** What the phone top bar calls the screen, with the app's name for an app other than the home app, such as "Overview, Loans". */
  readonly title: string
  /** A Lucide icon name such as `i-lucide-wallet`. */
  readonly icon: string
  /** What waits on the screen, such as the rows to review, shown beside its name. Left out at zero. */
  readonly count?: number
}

/** An app's entries under its name, with a line such as the company the books belong to. */
export interface NavigationGroup {
  readonly name: string
  readonly subtitle: string | null
  readonly entries: readonly NavigationEntry[]
}

export interface Navigation {
  /** One group per installed app, in install order. */
  readonly groups: readonly NavigationGroup[]
  /** The shell's own entries after the apps', such as Settings, set apart by a rule. */
  readonly apart: readonly NavigationEntry[]
}
</script>

<script setup lang="ts">
import { useId } from 'vue'
import { RouterLink } from 'vue-router'
import UIcon from '@nuxt/ui/components/Icon.vue'

defineProps<{
  navigation: Navigation
}>()

const id = useId()
</script>

<template>
  <nav aria-label="Screens" class="flex flex-col gap-4">
    <div
      v-for="(group, index) in navigation.groups"
      :key="group.name"
      role="group"
      :aria-labelledby="`${id}-${index}`"
      :aria-describedby="group.subtitle ? `${id}-${index}-subtitle` : undefined"
      class="flex flex-col gap-1"
      data-testid="nav-group"
    >
      <div class="px-3">
        <p :id="`${id}-${index}`" class="nav-heading">{{ group.name }}</p>
        <p v-if="group.subtitle" :id="`${id}-${index}-subtitle`" class="truncate text-xs text-muted">{{ group.subtitle }}</p>
      </div>
      <ul class="flex flex-col gap-0.5">
        <li v-for="entry in group.entries" :key="entry.to">
          <RouterLink :to="entry.to" class="nav-link" active-class="is-active">
            <UIcon :name="entry.icon" class="size-4 shrink-0" aria-hidden="true" />
            <span>{{ entry.label }}</span>
            <template v-if="entry.count">
              <span class="nav-count figure" aria-hidden="true" data-testid="nav-count">{{ entry.count }}</span>
              <span class="sr-only">, {{ entry.count }} waiting</span>
            </template>
          </RouterLink>
        </li>
      </ul>
    </div>
    <ul class="set-apart flex flex-col gap-0.5">
      <li v-for="entry in navigation.apart" :key="entry.to">
        <RouterLink :to="entry.to" class="nav-link" active-class="is-active">
          <UIcon :name="entry.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span>{{ entry.label }}</span>
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.set-apart {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-default);
}

.nav-heading {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-strong);
}

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

.nav-count {
  margin-inline-start: auto;
  min-width: 1.375rem;
  padding: 0 0.375rem;
  border-radius: 999px;
  background: var(--surface-elevated);
  color: var(--ink-secondary);
  font-size: 0.75rem;
  line-height: 1.25rem;
  text-align: center;
}

.nav-link.is-active .nav-count {
  background: var(--accent);
  color: var(--accent-ink);
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
