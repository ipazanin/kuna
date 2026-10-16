<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { useMediaQuery, usePhoneLayout } from '../layout/viewport'
import AppBrand from './AppBrand.vue'
import ScreenNavigation from './ScreenNavigation.vue'
import type { NavigationEntry } from './ScreenNavigation.vue'

withDefaults(
  defineProps<{
    navigation: readonly NavigationEntry[]
    title?: string
    /** A second line under the title, such as the company the workbook belongs to. */
    subtitle?: string | null
  }>(),
  { title: 'Ledgerboard', subtitle: null },
)

defineSlots<{
  default(): unknown
  sync(props: { compact: boolean }): unknown
}>()

const wide = useMediaQuery('(min-width: 1024px)')
const phone = usePhoneLayout()

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
        <AppBrand :title="title" :subtitle="subtitle" class="px-5 pt-6 pb-5" />
        <ScreenNavigation :navigation="navigation" class="flex-1 overflow-y-auto px-3" />
        <div v-if="$slots.sync" class="border-t border-default px-4 py-4">
          <slot name="sync" :compact="false" />
        </div>
      </div>
    </aside>

    <template v-else-if="phone">
      <header class="phone-header px-4 pb-1">
        <AppBrand :title="title" :subtitle="subtitle" />
      </header>

      <nav class="phone-bar" aria-label="Application">
        <USlideover v-model:open="menuOpen" side="bottom" :title="title" :ui="{ content: 'phone-sheet' }">
          <UButton icon="i-lucide-menu" label="Menu" color="neutral" variant="ghost" aria-label="Open navigation" data-testid="open-navigation" />
          <template #body>
            <ScreenNavigation :navigation="navigation" grid />
          </template>
        </USlideover>
        <div v-if="$slots.sync" class="ms-auto min-w-0">
          <slot name="sync" :compact="true" />
        </div>
      </nav>
    </template>

    <header
      v-else
      class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4"
    >
      <USlideover v-model:open="menuOpen" side="left" :title="title" :ui="{ content: 'max-w-72' }">
        <UButton icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Open navigation" />
        <template #body>
          <ScreenNavigation :navigation="navigation" />
        </template>
      </USlideover>
      <span class="truncate text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
      <div v-if="$slots.sync" class="ms-auto min-w-0">
        <slot name="sync" :compact="true" />
      </div>
    </header>

    <main class="app-main min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-9">
      <div class="mx-auto max-w-[90rem]">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
/* The installed app draws under the status bar and the gesture bar, so the phone chrome clears them. */
.phone-header {
  padding-top: max(1rem, env(safe-area-inset-top));
}

.phone-bar {
  position: fixed;
  z-index: 20;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--phone-bar-height);
  padding: 0.375rem max(0.75rem, env(safe-area-inset-right)) calc(0.375rem + env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  border-top: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--surface-page) 88%, transparent);
  backdrop-filter: blur(12px);
}

@media (max-width: 639px) {
  .app-main {
    padding-top: 1rem;
    padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    padding-bottom: calc(var(--phone-bar-height) + env(safe-area-inset-bottom) + 2rem);
  }
}
</style>
