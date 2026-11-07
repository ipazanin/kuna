<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { chatOpen, closeChat, openChat } from '../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../shared/ai/presentation/words'
import { words as sharedWords } from '../../shared/app/words'
import { useStickyBandPart } from '../../shared/layout/stickyBand'
import { useHeightAboveKeyboard, useMediaQuery, usePhoneLayout } from '../../shared/layout/viewport'
import { writesInFlight } from '../../shared/storage/application/writesInFlight'
import AppBrand from '../../shared/ui/AppBrand.vue'
import HomeLink from '../../shared/ui/HomeLink.vue'
import WriteProgress from '../../shared/ui/WriteProgress.vue'
import { words } from './words'

const props = withDefaults(
  defineProps<{
    /** The tile of the app on screen, for the phone top bar. A peek at another app's pages does not change it. */
    appOnScreen?: { readonly icon: string; readonly colour: `--${string}` } | null
    title?: string
    /** Whether the chat can open, which needs a key. Without one the shell shows no sign of it. */
    chatAvailable?: boolean
  }>(),
  { appOnScreen: null, title: 'Kuna', chatAvailable: false },
)

const emit = defineEmits<{
  drawerClosed: []
}>()

defineSlots<{
  default(): unknown
  navigation(props: { rail: boolean }): unknown
  chat(): unknown
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

/** A link to the page already on screen changes no address, so the watch above never closes the drawer for it. */
function closeOnCurrentPage(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a')?.href === window.location.href) menuOpen.value = false
}

watch(menuOpen, (open) => {
  if (!open) emit('drawerClosed')
})

function keepFocusAfterNavigation(event: Event): void {
  if (closedByNavigation) {
    event.preventDefault()
    closedByNavigation = false
  }
}

useStickyBandPart(useTemplateRef<HTMLElement>('topBar'))

const CHAT_QUERY = 'chat'
const router = useRouter()
/** Wide enough for a 56 px sidebar, a screen's smallest 784 px and a 384 px chat, so no screen gets less than a 1024 px window gives it. */
const docks = useMediaQuery('(min-width: 1224px)')
const chatShows = computed(() => props.chatAvailable && chatOpen.value)
const docked = computed(() => chatShows.value && docks.value)
/** Narrower, the chat takes the page's place. The page stays mounted, so its filters and its scroll survive. */
const inPane = computed(() => chatShows.value && !docks.value)

/**
 * While the chat stands in the page's place it is a step in the browser's history, so Back closes it, and any link to a
 * screen does too. A dock stays through every move, since the page beside it changes and the chat goes on.
 */
watch(
  () => route.query[CHAT_QUERY],
  (asked) => {
    if (asked !== undefined) openChat()
    else if (!docks.value) closeChat()
  },
  { immediate: true },
)
watch(chatOpen, (open) => {
  const inAddress = route.query[CHAT_QUERY] !== undefined
  if (open && !docks.value && !inAddress) {
    void router.push({ query: { ...route.query, [CHAT_QUERY]: '1' } })
  } else if (!open && inAddress) {
    if (window.history.state?.back) router.back()
    else void router.replace({ query: Object.fromEntries(Object.entries(route.query).filter(([name]) => name !== CHAT_QUERY)) })
  }
  if (!open && pane.value?.contains(document.activeElement)) void nextTick(() => shell.value?.querySelector<HTMLElement>('[data-testid="chat-open"]')?.focus())
})
watch(
  () => route.path,
  () => {
    if (!docks.value && route.query[CHAT_QUERY] === undefined) closeChat()
  },
)

const shell = useTemplateRef<HTMLElement>('shell')
const pane = useTemplateRef<HTMLElement>('pane')
const paneHeight = useHeightAboveKeyboard(pane)

/** The screen's name without its app's, as the router gives each route, since the tile and the drawer name the app. */
const screenTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : props.title))
</script>

<template>
  <div ref="shell" class="min-h-dvh lg:grid" :class="docked ? 'lg:grid-cols-[3.5rem_minmax(0,1fr)_24rem]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]'">
    <WriteProgress :active="writesInFlight > 0" :label="sharedWords.saving" class="write-progress fixed inset-x-0 z-top-bar" />
    <aside v-if="wide" class="border-e border-default bg-raised/60" :aria-label="words.navigation.sidebar">
      <div class="sticky top-0 flex h-dvh flex-col">
        <div class="border-b border-default py-2" :class="docked ? 'mx-1.5' : 'mx-3'">
          <HomeLink :label="sharedWords.homeLink" :look="docked ? 'rail' : 'standard'" />
        </div>
        <slot name="navigation" :rail="docked" />
        <div v-if="chatAvailable" class="border-t border-default py-2" :class="docked ? 'flex justify-center' : 'mx-3'">
          <UButton
            icon="i-lucide-sparkles"
            :label="docked ? '' : chatWords.chat.open"
            :aria-label="chatWords.chat.open"
            :aria-pressed="chatShows"
            :title="docked ? chatWords.chat.open : undefined"
            color="neutral"
            :variant="chatShows ? 'soft' : 'ghost'"
            :block="!docked"
            class="justify-start"
            data-testid="chat-open"
            @click="chatShows ? closeChat() : openChat()"
          />
        </div>
        <div v-if="$slots.sync" class="border-t border-default py-4" :class="docked ? 'rail-control flex justify-center px-1' : 'px-4'" data-testid="sidebar-sync">
          <slot name="sync" :compact="docked" />
        </div>
      </div>
    </aside>

    <header v-else ref="topBar" class="top-bar sticky top-0 z-top-bar flex h-14 items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4">
      <USlideover
        v-model:open="menuOpen"
        side="left"
        :title="title"
        :ui="{
          content: phone ? 'phone-drawer' : 'max-w-72',
          header: 'relative mx-4 min-h-0 border-b border-default px-0 py-2 sm:mx-6 sm:px-0',
          close: 'end-0 top-1/2 -translate-y-1/2',
          wrapper: 'sr-only',
          body: 'flex min-h-0 flex-col overflow-hidden px-1 py-0 sm:px-3 sm:py-0',
        }"
        :content="{ onCloseAutoFocus: keepFocusAfterNavigation }"
      >
        <UButton icon="i-lucide-menu" color="neutral" variant="ghost" :aria-label="words.navigation.open" data-testid="open-navigation" />
        <template #actions>
          <HomeLink :label="sharedWords.homeLink" look="standard" class="flex-1" />
        </template>
        <template #body>
          <div class="contents" @click="closeOnCurrentPage">
            <slot name="navigation" :rail="false" />
          </div>
        </template>
      </USlideover>
      <AppBrand v-if="phone" :title="screenTitle" :icon="appOnScreen?.icon" :colour="appOnScreen?.colour" data-testid="top-bar-title" />
      <span v-else class="truncate type-wordmark">{{ title }}</span>
      <!-- The screen's name gives way, so the sync or export controls keep their labels. -->
      <div class="ms-auto flex shrink-0 items-center gap-1">
        <UButton
          v-if="chatAvailable"
          icon="i-lucide-sparkles"
          :aria-label="chatWords.chat.open"
          :aria-pressed="chatShows"
          color="neutral"
          :variant="chatShows ? 'soft' : 'ghost'"
          class="justify-center"
          data-testid="chat-open"
          @click="chatShows ? closeChat() : openChat()"
        />
        <slot v-if="$slots.sync" name="sync" :compact="true" />
      </div>
    </header>

    <main v-show="!inPane" class="app-main min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-9">
      <div class="mx-auto max-w-shell">
        <slot />
      </div>
    </main>

    <div
      v-if="chatShows"
      ref="pane"
      class="min-w-0 bg-page"
      :class="wide ? 'sticky top-0 h-dvh' : 'chat-below-top-bar'"
      :style="!wide && paneHeight !== null ? { height: `${paneHeight}px` } : undefined"
      :data-chat-place="docked ? 'dock' : 'pane'"
      :data-testid="docked ? 'chat-dock' : 'chat-pane'"
    >
      <div class="h-full" :class="{ 'border-s border-default': docked }">
        <slot name="chat" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Before the keyboard's height is known, and where the browser cannot say. */
.chat-below-top-bar {
  height: calc(100dvh - 3.5rem);
}

/* The installed app draws under the status bar and the gesture bar, so the phone layout clears them. */
@media (max-width: 639px) {
  .top-bar {
    height: calc(3.5rem + env(safe-area-inset-top));
    padding-top: env(safe-area-inset-top);
    padding-inline: max(0.25rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-right));
  }

  .chat-below-top-bar {
    height: calc(100dvh - 3.5rem - env(safe-area-inset-top));
  }

  .app-main {
    padding-top: 1rem;
    padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  }
}
</style>
