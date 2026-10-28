<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import type { RedirectReturn } from '../shared/google/googleRedirect'
import { homeApp, installedApps } from './routing/appRegistry'
import { screenLoading } from './routing/router'
import { SETTINGS_SCREEN } from './routing/screens'
import AppShell from './ui/AppShell.vue'
import type { NavigationEntry } from './ui/ScreenNavigation.vue'
import ScreenSkeleton from './ui/ScreenSkeleton.vue'
import UpdatePrompt from './ui/UpdatePrompt.vue'

const props = defineProps<{
  /** Google's answer to a redirect sign-in, taken from the address before the router started. */
  googleReturn: RedirectReturn | null
}>()

const home = homeApp()

const navigation = computed((): NavigationEntry[] => [
  ...installedApps().flatMap((app) =>
    app.menu().map((screen) => {
      const count = app.menuCount(screen)
      return { to: screen.path, label: screen.title, icon: screen.icon, ...(count === null ? {} : { count }) }
    }),
  ),
  { to: SETTINGS_SCREEN.path, label: SETTINGS_SCREEN.title, icon: SETTINGS_SCREEN.icon, setApart: true },
])

const router = useRouter()
const route = useRoute()
const stops = installedApps().map((app) => app.start(router, props.googleReturn))
onBeforeUnmount(() => stops.forEach((stop) => stop()))

const firstRun = computed(() => home.firstRun())
const bare = computed(() => route.meta.bare === true)
// Once the router has read the address, so a link into the first run keeps its step.
void router.isReady().then(() =>
  watch(
    [firstRun, () => route.path === home.startPath],
    ([first, onStart]) => {
      if (first && !onStart) void router.replace(home.startPath)
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
    <AppShell v-else-if="!firstRun" :navigation="navigation" :subtitle="home.subtitle()">
      <RouterView v-slot="{ Component }">
        <ScreenSkeleton v-if="screenLoading || !Component" />
        <component :is="Component" v-else />
      </RouterView>
      <template #sync="{ compact }">
        <component :is="home.syncControl" :compact="compact" />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
