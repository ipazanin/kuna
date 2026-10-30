<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { words as sharedWords } from '../../shared/app/words'
import { useStickyBandPart } from '../../shared/layout/stickyBand'
import { useMediaQuery, usePhoneLayout } from '../../shared/layout/viewport'
import AppBrand from '../../shared/ui/AppBrand.vue'
import HomeLink from '../../shared/ui/HomeLink.vue'
import ScreenNavigation from './ScreenNavigation.vue'
import type { Navigation } from './ScreenNavigation.vue'
import { words } from './words'

const props = withDefaults(
  defineProps<{
    navigation: Navigation
    /** False on the home, whose cards are the way into the apps, so below 1024 px its top bar has no menu button. */
    drawer?: boolean
    title?: string
  }>(),
  { drawer: true, title: 'Kuna' },
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

useStickyBandPart(useTemplateRef<HTMLElement>('topBar'))

/** The screen's name without its app's, as the router gives each route, since the drawer names the app. */
const screenTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : props.title))
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside v-if="wide" class="border-e border-default bg-raised/60" :aria-label="words.navigation.sidebar">
      <div class="sticky top-0 flex h-dvh flex-col">
        <div class="mx-3 border-b border-default pt-4 pb-3">
          <HomeLink :label="sharedWords.homeLink" look="lead" />
        </div>
        <ScreenNavigation :navigation="navigation" class="flex-1 overflow-y-auto px-3 pt-5" />
        <div v-if="$slots.sync" class="border-t border-default px-4 py-4">
          <slot name="sync" :compact="false" />
        </div>
      </div>
    </aside>

    <header
      v-else
      ref="topBar"
      class="top-bar sticky top-0 z-top-bar flex h-14 items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4"
      :class="{ 'without-menu': !drawer }"
    >
      <USlideover
        v-if="drawer"
        v-model:open="menuOpen"
        side="left"
        :title="navigation.group?.name ?? title"
        :ui="{ content: phone ? 'phone-drawer' : 'max-w-72', header: 'mx-4 border-b border-default px-0 pt-4 pb-3 sm:mx-6 sm:px-0', wrapper: 'sr-only' }"
        :content="{ onCloseAutoFocus: keepFocusAfterNavigation }"
      >
        <UButton icon="i-lucide-menu" color="neutral" variant="ghost" :aria-label="words.navigation.open" data-testid="open-navigation" />
        <template #actions>
          <!-- As wide as the close button on either side, so the mark sits in the drawer's middle. -->
          <HomeLink :label="sharedWords.homeLink" look="lead" class="mx-11 flex-1" />
        </template>
        <template #body>
          <ScreenNavigation :navigation="navigation" />
        </template>
      </USlideover>
      <AppBrand v-if="phone" :title="drawer ? screenTitle : title" :icon="navigation.group?.icon" :colour="navigation.group?.colour" data-testid="top-bar-title" />
      <span v-else class="truncate type-wordmark">{{ title }}</span>
      <!-- The screen's name gives way, so the sync or export controls keep their labels. -->
      <div v-if="$slots.sync" class="ms-auto shrink-0">
        <slot name="sync" :compact="true" />
      </div>
    </header>

    <main class="app-main min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-9">
      <div class="mx-auto max-w-shell">
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

  /* With no menu button the mark lines up with the screen's own edge. */
  .top-bar.without-menu {
    padding-inline-start: max(1rem, env(safe-area-inset-left));
  }

  .app-main {
    padding-top: 1rem;
    padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  }
}
</style>
