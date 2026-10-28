<script setup lang="ts">
import { computed, onBeforeUnmount, watch, watchEffect } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import { resumedBy } from '../shared/google/googleRedirect'
import type { RedirectReturn } from '../shared/google/googleRedirect'
import { setMoneyFormat } from '../shared/money/moneyFormat'
import { startPageSync } from '../shared/sync/presentation/pageSync'
import { firstRunAt, homeApp, installedApps, ownsPath, screenName } from './routing/appRegistry'
import { screenLoading } from './routing/router'
import { SETTINGS_SCREEN } from './routing/screens'
import { keepPageSynced } from './sync/keepPageSynced'
import TopBarSync from './sync/TopBarSync.vue'
import AppShell from './ui/AppShell.vue'
import type { Navigation } from './ui/ScreenNavigation.vue'
import ScreenSkeleton from './ui/ScreenSkeleton.vue'
import UpdatePrompt from './ui/UpdatePrompt.vue'

const props = defineProps<{
  /** Google's answer to a redirect sign-in, taken from the address before the router started. */
  googleReturn: RedirectReturn | null
}>()

const home = homeApp()

const navigation = computed(
  (): Navigation => ({
    groups: installedApps().map((app) => ({
      app: app.id,
      name: app.name,
      subtitle: app.subtitle(),
      entries: app.menu().map((screen) => {
        const count = app.menuCount(screen)
        return { to: screen.path, label: screen.title, title: screenName(app, screen), icon: screen.icon, ...(count === null ? {} : { count }) }
      }),
    })),
    apart: [{ to: SETTINGS_SCREEN.path, label: SETTINGS_SCREEN.title, title: SETTINGS_SCREEN.title, icon: SETTINGS_SCREEN.icon }],
  }),
)

const router = useRouter()
const route = useRoute()
const pageSync = startPageSync(installedApps())
// Each app resumes only the find or pick it asked Google for, and the page's sync resumes after them.
const stops = [...installedApps().map((app) => app.start(router, resumedBy(props.googleReturn, app.id))), keepPageSynced(pageSync, props.googleReturn)]
onBeforeUnmount(() => stops.forEach((stop) => stop()))

// Settings and any address outside the apps show money as the home app does.
const appOnScreen = computed(() => installedApps().find((app) => ownsPath(app, route.path)) ?? home)
watchEffect(() => setMoneyFormat(appOnScreen.value.moneyFormat()))

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
</script>

<template>
  <UApp :toaster="toaster">
    <RouterView v-if="bare" />
    <AppShell v-else-if="inFirstRun === null" :navigation="navigation">
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
