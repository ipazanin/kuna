<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { useMediaQuery, usePhoneLayout } from '../layout/viewport'
import AppBrand from './AppBrand.vue'
import ScreenNavigation from './ScreenNavigation.vue'
import type { NavigationEntry } from './ScreenNavigation.vue'

const props = withDefaults(
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
/** Set when a link in the drawer closed it, so focus stays on the new screen's heading instead of returning to the menu button. */
let closedByNavigation = false
watch(
  () => route.fullPath,
  () => {
    closedByNavigation = menuOpen.value
    menuOpen.value = false
  },
)

function keepFocusAfterNavigation(event: Event): void {
  if (closedByNavigation) {
    event.preventDefault()
    closedByNavigation = false
  }
}

const screenTitle = computed(() => props.navigation.find((entry) => entry.to === route.path)?.label ?? props.title)
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

    <header
      v-else
      class="top-bar sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4"
    >
      <USlideover
        v-model:open="menuOpen"
        side="left"
        :title="title"
        v-bind="phone && subtitle ? { description: subtitle } : {}"
        :ui="{ content: phone ? 'phone-drawer' : 'max-w-72' }"
        :content="{ onCloseAutoFocus: keepFocusAfterNavigation }"
      >
        <UButton icon="i-lucide-menu" color="neutral" variant="ghost" aria-label="Open navigation" data-testid="open-navigation" />
        <template #body>
          <ScreenNavigation :navigation="navigation" />
        </template>
      </USlideover>
      <AppBrand v-if="phone" :title="screenTitle" :subtitle="null" class="min-w-0" data-testid="top-bar-title" />
      <span v-else class="truncate text-[0.9375rem] font-semibold tracking-tight text-highlighted">{{ title }}</span>
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
/* The installed app draws under the status bar and the gesture bar, so the phone layout clears them. */
@media (max-width: 639px) {
  .top-bar {
    height: calc(3.5rem + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
    padding-inline: max(0.25rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-right));
  }

  .app-main {
    padding-top: 1rem;
    padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  }
}
</style>
