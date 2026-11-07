<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'
import { en_gb, hr } from '@nuxt/ui/locale'

import { CHAT_DOCK_QUERY, chatOpen } from '../shared/ai/presentation/chatDock'
import { assistKeyKept } from '../shared/ai/presentation/useAiTask'
import { useMediaQuery } from '../shared/layout/viewport'
import { resumedBy } from '../shared/google/googleRedirect'
import type { RedirectReturn } from '../shared/google/googleRedirect'
import { DEFAULT_MONEY_FORMAT, setMoneyFormat } from '../shared/money/moneyFormat'
import { language } from '../shared/text/language'
import { startPageSync } from '../shared/sync/presentation/pageSync'
import { appAt, firstRunAt, installedApps } from './routing/appRegistry'
import { screenLoading } from './routing/router'
import { keepPageSynced } from './sync/keepPageSynced'
import TopBarSync from './sync/TopBarSync.vue'
import AppShell from './ui/AppShell.vue'
import { navigationOf } from './ui/navigation'
import ScreenNavigation from './ui/ScreenNavigation.vue'
import ScreenSkeleton from '../shared/ui/ScreenSkeleton.vue'
import UpdatePrompt from './ui/UpdatePrompt.vue'
import { warnWhileSaving } from './ui/warnWhileSaving'
import { KUNA_SETTINGS_SCREEN, NET_WORTH_SCREEN } from './routing/screens'

const props = defineProps<{
  /** Google's answer to a redirect sign-in, taken from the address before the router started. */
  googleReturn: RedirectReturn | null
}>()

const router = useRouter()
const route = useRoute()

const appOnScreen = computed(() => appAt(installedApps(), route.path))

/**
 * The app whose pages show, which follows the address and is never stored, so a reload or a deep link is right by itself.
 * It starts from the address the router has yet to read, so a deep link opens its app without animating on load.
 */
const openApp = ref(appAt(installedApps(), router.resolve(router.options.history.location).path)?.id ?? null)
function followAddress(): void {
  openApp.value = appOnScreen.value?.id ?? null
}

watch(() => route.path, followAddress)

function togglePages(appId: string): void {
  openApp.value = openApp.value === appId ? null : appId
}

const navigation = computed(() => navigationOf(installedApps(), openApp.value))

const pageSync = startPageSync(installedApps())
/** The sync or export control has nothing to show until some app has a file, so its place stays out of the shell too. */
const someFileChosen = computed(() => pageSync.groups.some((group) => group.store.state.choice !== null))
// Each app resumes only the find or pick it asked Google for, and the page's sync resumes after them.
const stops = [...installedApps().map((app) => app.start(router, resumedBy(props.googleReturn, app.id))), keepPageSynced(pageSync, props.googleReturn), warnWhileSaving()]
onBeforeUnmount(() => stops.forEach((stop) => stop()))

// The home formats each card in its own app's format, so outside the apps the page keeps the default.
watchEffect(() => setMoneyFormat(appOnScreen.value?.moneyFormat() ?? DEFAULT_MONEY_FORMAT))

const inFirstRun = computed(() => firstRunAt(installedApps(), route.path))
const bare = computed(() => route.meta.bare === true)
// Once the router has read the address, so a link into the first run keeps its step, and an address it redirects to the home leaves no app open.
void router.isReady().then(() => {
  followAddress()
  watch(
    [inFirstRun, () => route.path],
    ([app, path]) => {
      if (app !== null && path !== app.startPath) void router.replace(app.startPath)
    },
    { immediate: true },
  )
})

const docks = useMediaQuery(CHAT_DOCK_QUERY)
/** Toasts rise from the bottom, clear of the gesture bar in the installed app and of the docked chat's column. */
const toaster = computed(() => ({
  ui: { viewport: `bottom-[max(1rem,env(safe-area-inset-bottom))] ${assistKeyKept.value && chatOpen.value && docks.value ? 'right-[calc(var(--spacing-chat-dock)+1rem)]' : ''}` },
}))

/** The chat's code loads only once a person with a key opens it. */
const ChatPanel = defineAsyncComponent(() => import('../shared/ai/presentation/ChatPanel.vue'))
const KUNA_SCREENS = [NET_WORTH_SCREEN, KUNA_SETTINGS_SCREEN].map(({ path, title }) => ({ path, title }))
const screenName = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : null))

const uiLocale = language === 'hr' ? hr : en_gb
</script>

<template>
  <UApp :toaster="toaster" :locale="uiLocale">
    <RouterView v-if="bare" />
    <AppShell
      v-else-if="inFirstRun === null"
      :app-on-screen="appOnScreen === null ? null : { icon: appOnScreen.homeCard.icon, colour: appOnScreen.colour }"
      :chat-available="assistKeyKept"
      @drawer-closed="followAddress"
    >
      <RouterView v-slot="{ Component }">
        <ScreenSkeleton v-if="screenLoading || !Component" />
        <component :is="Component" v-else />
      </RouterView>
      <template #navigation="{ rail, chat }">
        <ScreenNavigation :navigation="navigation" :rail="rail" :chat="chat" @toggle="togglePages" @open="openApp = $event" />
      </template>
      <template #chat>
        <ChatPanel :app="appOnScreen" :screen="screenName" :path="route.path" :apps="installedApps()" :kuna-screens="KUNA_SCREENS" />
      </template>
      <template v-if="someFileChosen" #sync="{ compact, rail }">
        <TopBarSync :compact="compact" :rail="rail" />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
