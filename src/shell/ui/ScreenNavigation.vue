<script lang="ts">
export interface NavigationEntry {
  readonly to: string
  /** Its name in the menu, such as Overview. */
  readonly label: string
  /** A Lucide icon name such as `i-lucide-wallet`. */
  readonly icon: string
  /** What waits on the screen, such as the rows to review, shown beside its name. Left out at zero. */
  readonly count?: number
}

/** The app on screen: its entries under its name, with a line such as the company the books belong to. */
export interface NavigationGroup {
  readonly name: string
  /** The app's icon and the custom property of its colour, which tile its name. */
  readonly icon: string
  readonly colour: `--${string}`
  readonly subtitle: string | null
  readonly entries: readonly NavigationEntry[]
}

/** An app in the menu of the home and Kuna's own screens, its icon on a tile in its colour. */
export interface NavigationApp {
  readonly id: string
  readonly to: string
  readonly name: string
  readonly icon: string
  readonly colour: `--${string}`
  /** Shown beside its name while the app waits for its first run, such as Set up. */
  readonly badge: string | null
}

export interface Navigation {
  /** Null on the home and Kuna's own screens. */
  readonly group: NavigationGroup | null
  /** Every app, on the home and Kuna's own screens. Empty inside an app. */
  readonly apps: readonly NavigationApp[]
  /** Settings, the app's or Kuna's, set apart below the app's entries or the list of apps. */
  readonly apart: readonly NavigationEntry[]
}
</script>

<script setup lang="ts">
import { useId } from 'vue'
import { RouterLink } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { plural } from '../../shared/text/translation'
import AppMark from '../../shared/ui/AppMark.vue'
import { words } from './words'

defineProps<{
  navigation: Navigation
}>()

const id = useId()
</script>

<template>
  <nav :aria-label="words.navigation.label" class="flex flex-col gap-4">
    <div
      v-if="navigation.group !== null"
      role="group"
      :aria-labelledby="`${id}-name`"
      :aria-describedby="navigation.group.subtitle ? `${id}-subtitle` : undefined"
      class="flex flex-col gap-3"
      data-testid="nav-group"
    >
      <div class="flex items-center gap-2.5 px-3">
        <AppMark :icon="navigation.group.icon" :colour="navigation.group.colour" size="medium" />
        <div class="min-w-0">
          <p :id="`${id}-name`" class="truncate type-wordmark" data-testid="nav-heading">{{ navigation.group.name }}</p>
          <p v-if="navigation.group.subtitle" :id="`${id}-subtitle`" class="truncate type-caption">{{ navigation.group.subtitle }}</p>
        </div>
      </div>
      <ul class="flex flex-col gap-0.5">
        <li v-for="entry in navigation.group.entries" :key="entry.to">
          <RouterLink :to="entry.to" class="nav-link" active-class="is-active">
            <UIcon :name="entry.icon" class="size-4 shrink-0" aria-hidden="true" />
            <span>{{ entry.label }}</span>
            <template v-if="entry.count">
              <span class="nav-count figure" aria-hidden="true" data-testid="nav-count">{{ entry.count }}</span>
              <span class="sr-only">{{ plural(words.navigation.waiting(entry.count), entry.count) }}</span>
            </template>
          </RouterLink>
        </li>
      </ul>
    </div>
    <ul v-if="navigation.apps.length > 0" class="flex flex-col gap-0.5" data-testid="nav-apps">
      <li v-for="app in navigation.apps" :key="app.id">
        <RouterLink :to="app.to" class="nav-link" :data-app="app.id" :data-state="app.badge === null ? 'open' : 'set-up'">
          <AppMark :icon="app.icon" :colour="app.colour" />
          <span class="min-w-0 truncate">{{ app.name }}</span>
          <UBadge v-if="app.badge !== null" :label="app.badge" color="primary" variant="subtle" size="sm" class="ms-auto shrink-0" />
        </RouterLink>
      </li>
    </ul>
    <ul class="flex flex-col gap-0.5" :class="{ 'set-apart': navigation.group !== null || navigation.apps.length > 0 }" data-testid="nav-apart">
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
