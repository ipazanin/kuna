<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { CHAT_QUERY, chatOpen, chatWidth, closeChat, openChat } from '../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../shared/ai/presentation/words'
import CompanyFooter from '../../shared/app/CompanyFooter.vue'
import { words as sharedWords } from '../../shared/app/words'
import { useStickyBandPart } from '../../shared/layout/stickyBand'
import { givePageRoom } from '../../shared/layout/pageRoom'
import { useHeightAboveKeyboard, useMediaQuery, usePhoneLayout, useWindowWidth } from '../../shared/layout/viewport'
import { writesInFlight } from '../../shared/storage/application/writesInFlight'
import AppBrand from '../../shared/ui/AppBrand.vue'
import HomeLink from '../../shared/ui/HomeLink.vue'
import WriteProgress from '../../shared/ui/WriteProgress.vue'
import ChatResizeHandle from './ChatResizeHandle.vue'
import { FOOTER_FOLDS_BELOW_HEIGHT, layoutOf, PAGE_INSET, pageInsetOf, SIDEBAR_WIDTH, sidebarChoice, someSidebarFits } from './sidebarLayout'
import SidebarLayoutMenu from './SidebarLayoutMenu.vue'
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
  /** A press on the Jump to a page button. */
  quickJump: []
}>()

defineSlots<{
  default(): unknown
  navigation(props: { rail: boolean; chat: boolean; drawer: boolean }): unknown
  chat(): unknown
  sync(props: { compact: boolean; rail: boolean }): unknown
}>()

const phone = usePhoneLayout()
const windowWidth = useWindowWidth()
const chatShows = computed(() => props.chatAvailable && chatOpen.value)

/** The chat's width under the pointer while its edge is dragged, or null. */
const drag = ref<number | null>(null)
/** The layout with the chat open, which also says whether it would dock while it is closed. */
const withChat = computed(() => layoutOf({ choice: sidebarChoice.value, windowWidth: windowWidth.value, chat: drag.value ?? chatWidth.value }))
const layout = computed(() => (chatShows.value ? withChat.value : layoutOf({ choice: sidebarChoice.value, windowWidth: windowWidth.value, chat: null })))
const docks = computed(() => withChat.value.chat.at === 'dock')
const dock = computed(() => (layout.value.chat.at === 'dock' ? layout.value.chat : null))
const docked = computed(() => dock.value !== null)
/** Narrower, the chat takes the page's place. The page stays mounted, so its filters and its scroll survive. */
const inPane = computed(() => layout.value.chat.at === 'page')
const sidebar = computed(() => layout.value.sidebar)
const rail = computed(() => sidebar.value === 'icons')
const sidebarShows = computed(() => sidebar.value === 'expanded' || sidebar.value === 'icons')
const topBar = computed(() => !sidebarShows.value)
const short = useMediaQuery(`(max-height: ${FOOTER_FOLDS_BELOW_HEIGHT - 1}px)`)
/** The footer as the icon sidebar's logo button, beside Sync on a short window. */
const footerFolded = computed(() => !rail.value && short.value)

const inset = computed(() => pageInsetOf(layout.value.page))
const padding = computed(() => (inset.value === 'phone' ? undefined : { paddingInline: `${PAGE_INSET[inset.value].inline}px`, paddingTop: `${PAGE_INSET[inset.value].top}px` }))
watchEffect(() => givePageRoom(layout.value.page - 2 * PAGE_INSET[inset.value].inline))

/**
 * The widths and the top bar's height drawn now, on the root, since the toaster's viewport is portalled out of the shell
 * and reads the chat's, and a page's sticky bar sits under the top bar.
 */
watchEffect(() => {
  const root = document.documentElement.style
  root.setProperty('--sidebar-width', `${SIDEBAR_WIDTH[sidebar.value]}px`)
  root.setProperty('--top-bar-height', !topBar.value ? '0px' : phone.value ? 'calc(3.5rem + env(safe-area-inset-top))' : '3.5rem')
  if (dock.value === null) root.removeProperty('--chat-width')
  else root.setProperty('--chat-width', `${dock.value.width}px`)
})
onBeforeUnmount(() => {
  for (const property of ['--sidebar-width', '--top-bar-height', '--chat-width']) document.documentElement.style.removeProperty(property)
})

/** While the window is being resized the columns follow it at once, since easing them would trail the window's edge. */
let resizeSettles = 0
function followResize(): void {
  document.documentElement.classList.add('shell-resizing')
  clearTimeout(resizeSettles)
  resizeSettles = window.setTimeout(() => document.documentElement.classList.remove('shell-resizing'), 200)
}
window.addEventListener('resize', followResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', followResize)
  clearTimeout(resizeSettles)
  document.documentElement.classList.remove('shell-resizing')
})

const columns = computed(() => {
  if (sidebarShows.value) return docked.value ? 'grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--chat-width)]' : 'grid-cols-[var(--sidebar-width)_minmax(0,1fr)]'
  return docked.value ? 'grid-cols-[minmax(0,1fr)_var(--chat-width)]' : 'grid-cols-[minmax(0,1fr)]'
})
/** The dock is the last column. In the page's place the chat sits under the top bar, or beside the sidebar for the window's height. */
const paneCell = computed(() => {
  if (docked.value) return sidebarShows.value ? 'col-start-3 row-span-2 row-start-1 sticky top-0 h-dvh' : 'col-start-2 row-span-2 row-start-1 sticky top-0 h-dvh'
  return topBar.value ? 'chat-below-top-bar col-start-1 row-start-2' : 'col-start-2 row-span-2 row-start-1 sticky top-0 h-dvh'
})
const dockId = useId()

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

const router = useRouter()

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
  if (!open && focusBeforePane === null && pane.value?.contains(document.activeElement)) void nextTick(() => shell.value?.querySelector<HTMLElement>('[data-testid="chat-open"]')?.focus())
})
watch(
  () => route.path,
  () => {
    if (!docks.value && route.query[CHAT_QUERY] === undefined) closeChat()
  },
)

/** Hiding the page collapses the document and loses its scroll, so the pane keeps it and gives it back, unless a link led to another screen. */
let placeBeforePane: { readonly path: string; readonly scrollY: number } | null = null
/** What held focus in the page when the chat took its place, which gets it back when the page returns. */
let focusBeforePane: HTMLElement | null = null
watch(inPane, (shown) => {
  if (shown) {
    placeBeforePane = { path: route.path, scrollY: window.scrollY }
    const focused = document.activeElement
    if (focused instanceof HTMLElement && main.value?.contains(focused)) {
      focusBeforePane = focused
      void nextTick(() => pane.value?.querySelector<HTMLElement>('textarea')?.focus())
    }
    return
  }
  const back = focusBeforePane
  focusBeforePane = null
  if (back === null) return
  // A chat that docks keeps the focus it has. One that closed leaves focus nowhere, and the page takes it back.
  const leftInPane = pane.value?.contains(document.activeElement) ?? false
  if (chatShows.value && leftInPane) return
  void nextTick(() => (back.isConnected ? back : main.value?.querySelector<HTMLElement>('.screen-title'))?.focus())
})

/** A sidebar that folds into the drawer while it held focus hands it to the top bar's menu button. */
watch(sidebarShows, (shows) => {
  if (shows || !shell.value?.querySelector('[data-testid="sidebar"]')?.contains(document.activeElement)) return
  void nextTick(() => shell.value?.querySelector<HTMLElement>('[data-testid="open-navigation"]')?.focus())
})
/** The page is back only once its history step is too, as Back also makes the router restore a scroll it read from the collapsed document. */
const pageIsBack = computed(() => !inPane.value && route.query[CHAT_QUERY] === undefined)
watch(pageIsBack, (back) => {
  const place = placeBeforePane
  if (!back || place === null) return
  placeBeforePane = null
  void nextTick(() =>
    requestAnimationFrame(() => {
      if (route.path === place.path) window.scrollTo(0, place.scrollY)
    }),
  )
})

const shell = useTemplateRef<HTMLElement>('shell')
const pane = useTemplateRef<HTMLElement>('pane')
const main = useTemplateRef<HTMLElement>('main')

/** The way past the menu: the screen's title, or the chat's prompt while the chat holds the page. */
function skipToContent(): void {
  if (inPane.value) {
    pane.value?.querySelector<HTMLElement>('textarea')?.focus()
    return
  }
  ;(main.value?.querySelector<HTMLElement>('.screen-title') ?? main.value)?.focus()
}
const paneHeight = useHeightAboveKeyboard(pane)

/** The screen's name without its app's, as the router gives each route, since the tile and the drawer name the app. */
const screenTitle = computed(() => route.meta.title ?? props.title)
</script>

<template>
  <div
    ref="shell"
    class="grid min-h-dvh grid-rows-[auto_1fr]"
    :class="[columns, drag === null ? 'transition-[grid-template-columns] duration-fade' : '']"
    :data-sidebar="sidebar"
    data-testid="app-shell"
  >
    <UButton :label="words.navigation.skip" color="neutral" variant="outline" class="skip-link" data-testid="skip-link" @click="skipToContent" />
    <WriteProgress :active="writesInFlight > 0" :label="sharedWords.saving" class="write-progress fixed inset-x-0 z-top-bar" />
    <aside v-if="sidebarShows" class="col-start-1 row-span-2 row-start-1 border-e border-default bg-raised/60" :aria-label="words.navigation.sidebar" data-testid="sidebar">
      <div class="sticky top-0 flex h-dvh flex-col">
        <div class="flex border-b border-default py-2" :class="rail ? 'mx-1.5 flex-col items-stretch gap-0.5' : 'mx-3 min-h-14 items-center gap-0.5'">
          <HomeLink :label="sharedWords.homeLink" :look="rail ? 'rail' : 'standard'" class="min-w-0 flex-1" />
          <UTooltip :text="words.quickJump.title" :kbds="['meta', 'k']" :content="{ side: rail ? 'right' : 'bottom' }">
            <UButton icon="i-lucide-search" color="neutral" variant="ghost" class="justify-center" :aria-label="words.quickJump.title" data-testid="quick-jump-open" @click="emit('quickJump')" />
          </UTooltip>
          <SidebarLayoutMenu :window-width="windowWidth" :chat="chatShows ? chatWidth : null" />
        </div>
        <slot name="navigation" :rail="rail" :chat="chatAvailable" :drawer="false" />
        <div v-if="$slots.sync && footerFolded" class="flex items-end gap-2 border-t border-default py-4 ps-4 pe-2" data-testid="sidebar-sync">
          <div class="min-w-0 flex-1">
            <slot name="sync" :compact="false" :rail="false" />
          </div>
          <CompanyFooter look="rail" class="w-11 shrink-0" />
        </div>
        <template v-else>
          <div v-if="$slots.sync" class="border-t border-default py-4" :class="rail ? 'flex justify-center px-1' : 'px-4'" data-testid="sidebar-sync">
            <slot name="sync" :compact="rail" :rail="rail" />
          </div>
          <div class="border-t border-default py-2" :class="rail ? 'px-1.5' : 'px-2'">
            <CompanyFooter :look="rail || footerFolded ? 'rail' : 'sidebar'" />
          </div>
        </template>
      </div>
    </aside>

    <header
      v-if="topBar"
      ref="topBar"
      class="top-bar sticky top-0 z-top-bar col-start-1 row-start-1 flex h-(--top-bar-height) items-center gap-2 border-b border-default bg-page/85 px-2 backdrop-blur-md sm:px-4"
    >
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
          <!-- The drawer's close button sits over the end of this row, so the layout menu stops short of it. -->
          <SidebarLayoutMenu v-if="someSidebarFits(windowWidth)" :window-width="windowWidth" :chat="chatShows ? chatWidth : null" class="me-10" />
        </template>
        <template #body>
          <div class="contents" @click="closeOnCurrentPage">
            <slot name="navigation" :rail="false" :chat="false" :drawer="true" />
          </div>
          <div class="border-t border-default px-1 py-2">
            <CompanyFooter look="sidebar" />
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
        <slot v-if="$slots.sync" name="sync" :compact="true" :rail="false" />
      </div>
    </header>

    <main v-show="!inPane" ref="main" tabindex="-1" class="app-main row-start-2 flex min-w-0 flex-col pb-6 outline-none" :class="sidebarShows ? 'col-start-2' : 'col-start-1'" :style="padding">
      <div class="mx-auto w-full max-w-shell flex-1 sm:@container">
        <slot />
      </div>
    </main>

    <div
      v-if="chatShows"
      :id="dockId"
      ref="pane"
      class="min-w-0 bg-page"
      :class="paneCell"
      :style="topBar && !docked && paneHeight !== null ? { height: `${paneHeight}px` } : undefined"
      :data-chat-place="docked ? 'dock' : 'pane'"
      :data-testid="docked ? 'chat-dock' : 'chat-pane'"
    >
      <div class="relative h-full" :class="{ 'border-s border-default': docked }">
        <ChatResizeHandle v-if="dock !== null" :width="dock.width" :widest="dock.widest" :controls="dockId" @drag="drag = $event" @release="drag = null" />
        <slot name="chat" />
      </div>
    </div>
  </div>
</template>
