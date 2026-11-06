<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'
import { en_gb, hr } from '@nuxt/ui/locale'

import { resumedBy } from '../shared/google/googleRedirect'
import type { RedirectReturn } from '../shared/google/googleRedirect'
import { DEFAULT_MONEY_FORMAT, setMoneyFormat } from '../shared/money/moneyFormat'
import { language } from '../shared/text/language'
import { startPageSync } from '../shared/sync/presentation/pageSync'
import { appAt, firstRunAt, installedApps } from './routing/appRegistry'
import { screenLoading } from './routing/router'
import { HOME_SCREEN } from './routing/screens'
import { keepPageSynced } from './sync/keepPageSynced'
import TopBarSync from './sync/TopBarSync.vue'
import AppShell from './ui/AppShell.vue'
import { navigationOf } from './ui/navigation'
import ScreenNavigation from './ui/ScreenNavigation.vue'
import ScreenSkeleton from '../shared/ui/ScreenSkeleton.vue'
import UpdatePrompt from './ui/UpdatePrompt.vue'

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
// Each app resumes only the find or pick it asked Google for, and the page's sync resumes after them.
const stops = [...installedApps().map((app) => app.start(router, resumedBy(props.googleReturn, app.id))), keepPageSynced(pageSync, props.googleReturn)]
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

/** Toasts rise from the bottom, clear of the gesture bar in the installed app. */
const toaster = { ui: { viewport: 'bottom-[max(1rem,env(safe-area-inset-bottom))]' } }

const uiLocale = language === 'hr' ? hr : en_gb
</script>

<template>
  <UApp :toaster="toaster" :locale="uiLocale">
    <RouterView v-if="bare" />
    <AppShell
      v-else-if="inFirstRun === null"
      :app-on-screen="appOnScreen === null ? null : { icon: appOnScreen.homeCard.icon, colour: appOnScreen.colour }"
      :drawer="route.path !== HOME_SCREEN.path"
      @drawer-closed="followAddress"
    >
      <RouterView v-slot="{ Component }">
        <ScreenSkeleton v-if="screenLoading || !Component" />
        <component :is="Component" v-else />
      </RouterView>
      <template #navigation>
        <ScreenNavigation :navigation="navigation" @toggle="togglePages" @open="openApp = $event" />
      </template>
      <template #sync="{ compact }">
        <TopBarSync :compact="compact" />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
