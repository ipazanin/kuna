<script lang="ts">
export interface NavigationEntry {
  readonly to: string
  readonly label: string
  /** A Lucide icon name such as `i-lucide-wallet`. */
  readonly icon: string
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

withDefaults(
  defineProps<{
    navigation: readonly NavigationEntry[]
    title?: string
  }>(),
  { title: 'Ledgerboard' },
)

defineSlots<{
  default(): unknown
  sync(props: { compact: boolean }): unknown
}>()

const wideQuery = window.matchMedia('(min-width: 1024px)')
const wide = ref(wideQuery.matches)
const followWidth = (change: MediaQueryListEvent): void => {
  wide.value = change.matches
}
wideQuery.addEventListener('change', followWidth)
onBeforeUnmount(() => wideQuery.removeEventListener('change', followWidth))

const menuOpen = ref(false)
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  },
)
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside v-if="wide" class="border-e border-default bg-raised/60" aria-label="Application">
      <div class="sticky top-0 flex h-dvh flex-col">
        <div class="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <svg viewBox="0 0 32 32" class="size-6 shrink-0" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--accent)" />
            <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <span class="text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
        </div>
        <nav aria-label="Screens" class="flex-1 overflow-y-auto px-3">
          <ul class="flex flex-col gap-0.5">
            <li v-for="entry in navigation" :key="entry.to">
              <RouterLink :to="entry.to" class="nav-link" active-class="is-active">
                <UIcon :name="entry.icon" class="size-4 shrink-0" aria-hidden="true" />
                <span>{{ entry.label }}</span>
              </RouterLink>
            </li>
          </ul>
        </nav>
        <div v-if="$slots.sync" class="border-t border-default px-4 py-4">
          <slot name="sync" :compact="false" />
        </div>
      </div>
    </aside>

    <header
      v-else
      class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4"
    >
      <USlideover v-model:open="menuOpen" side="left" :title="title" :ui="{ content: 'max-w-72' }">
        <UButton icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Open navigation" />
        <template #body>
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
      </USlideover>
      <span class="truncate text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
      <div v-if="$slots.sync" class="ms-auto min-w-0">
        <slot name="sync" :compact="true" />
      </div>
    </header>

    <main class="min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-9">
      <div class="mx-auto max-w-[90rem]">
        <slot />
      </div>
    </main>
  </div>
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
