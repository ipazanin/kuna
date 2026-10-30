<script setup lang="ts">
import { computed, onBeforeUnmount, watch, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'
import { en_gb, hr } from '@nuxt/ui/locale'

import { resumedBy } from '../shared/google/googleRedirect'
import type { RedirectReturn } from '../shared/google/googleRedirect'
import { DEFAULT_MONEY_FORMAT, setMoneyFormat } from '../shared/money/moneyFormat'
import { language } from '../shared/text/language'
import { startPageSync } from '../shared/sync/presentation/pageSync'
import { words as homeWords } from './home/words'
import { entryPath, firstRunAt, installedApps, ownsPath } from './routing/appRegistry'
import { screenLoading } from './routing/router'
import { HOME_SCREEN, KUNA_SETTINGS_SCREEN } from './routing/screens'
import { words as settingsWords } from './settings/words'
import { keepPageSynced } from './sync/keepPageSynced'
import TopBarSync from './sync/TopBarSync.vue'
import AppShell from './ui/AppShell.vue'
import type { Navigation } from './ui/ScreenNavigation.vue'
import ScreenSkeleton from '../shared/ui/ScreenSkeleton.vue'
import UpdatePrompt from './ui/UpdatePrompt.vue'

const props = defineProps<{
  /** Google's answer to a redirect sign-in, taken from the address before the router started. */
  googleReturn: RedirectReturn | null
}>()

const router = useRouter()
const route = useRoute()

const appOnScreen = computed(() => installedApps().find((app) => ownsPath(app, route.path)) ?? null)

/** Only the menu of the app on screen. The home and Kuna's own screens list every app, with Kuna settings set apart. */
const navigation = computed((): Navigation => {
  const app = appOnScreen.value
  if (app === null) {
    return {
      group: null,
      apps: installedApps().map((installed) => ({
        id: installed.id,
        to: entryPath(installed),
        name: installed.name,
        icon: installed.homeCard.icon,
        colour: installed.colour,
        badge: installed.firstRun() ? homeWords.setUp : null,
      })),
      apart: [{ to: KUNA_SETTINGS_SCREEN.path, label: settingsWords.menu, icon: KUNA_SETTINGS_SCREEN.icon }],
    }
  }
  return {
    group: {
      name: app.name,
      icon: app.homeCard.icon,
      colour: app.colour,
      subtitle: app.subtitle(),
      entries: app.menu().map((screen) => {
        const count = app.menuCount(screen)
        return { to: screen.path, label: screen.title, icon: screen.icon, ...(count === null ? {} : { count }) }
      }),
    },
    apps: [],
    apart: [{ to: app.settings.path, label: app.settings.title, icon: app.settings.icon }],
  }
})

const pageSync = startPageSync(installedApps())
// Each app resumes only the find or pick it asked Google for, and the page's sync resumes after them.
const stops = [...installedApps().map((app) => app.start(router, resumedBy(props.googleReturn, app.id))), keepPageSynced(pageSync, props.googleReturn)]
onBeforeUnmount(() => stops.forEach((stop) => stop()))

// The home formats each card in its own app's format, so outside the apps the page keeps the default.
watchEffect(() => setMoneyFormat(appOnScreen.value?.moneyFormat() ?? DEFAULT_MONEY_FORMAT))

const inFirstRun = computed(() => firstRunAt(installedApps(), route.path))
const bare = computed(() => route.meta.bare === true)
// Once the router has read the address, so a link into the first run keeps its step.
void router.isReady().then(() =>
  watch(
    [inFirstRun, () => route.path],
    ([app, path]) => {
      if (app !== null && path !== app.startPath) void router.replace(app.startPath)
    },
    { immediate: true },
  ),
)

/** Toasts rise from the bottom, clear of the gesture bar in the installed app. */
const toaster = { ui: { viewport: 'bottom-[max(1rem,env(safe-area-inset-bottom))]' } }

const uiLocale = language === 'hr' ? hr : en_gb
</script>

<template>
  <UApp :toaster="toaster" :locale="uiLocale">
    <RouterView v-if="bare" />
    <AppShell v-else-if="inFirstRun === null" :navigation="navigation" :drawer="route.path !== HOME_SCREEN.path">
      <RouterView v-slot="{ Component }">
        <ScreenSkeleton v-if="screenLoading || !Component" />
        <component :is="Component" v-else />
      </RouterView>
      <template #sync="{ compact }">
        <TopBarSync :compact="compact" />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
