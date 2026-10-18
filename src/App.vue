<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import WelcomeScreen from './features/data-source/presentation/WelcomeScreen.vue'
import LocalWorkbookStatus from './features/excel/presentation/LocalWorkbookStatus.vue'
import { bindFiltersToRouter } from './features/filters/application/filterStore'
import { useSettings } from './features/settings/application/useSettings'
import { startAutoSync } from './features/workbook/application/autoSync'
import { useWorkbook } from './features/workbook/application/workbookStore'
import { syncStateOf } from './features/workbook/presentation/syncState'
import { screenLoading } from './shared/routing/router'
import { SCREENS } from './shared/routing/screens'
import AppShell from './shared/ui/AppShell.vue'
import ScreenSkeleton from './shared/ui/ScreenSkeleton.vue'
import SyncStatus from './shared/ui/SyncStatus.vue'
import UpdatePrompt from './shared/ui/UpdatePrompt.vue'

const settings = useSettings()
const navigation = computed(() =>
  SCREENS.filter((screen) => settings.value.ownerPayModule || screen.ownerPayPack !== true).map((screen) => ({
    to: screen.path,
    label: screen.title,
    icon: screen.icon,
  })),
)

bindFiltersToRouter(useRouter())

const store = useWorkbook()
const { state, sync } = store
const stopAutoSync = startAutoSync({
  store,
  now: () => Date.now(),
  online: () => navigator.onLine,
  onVisible(callback) {
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') callback()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  },
})
onBeforeUnmount(stopAutoSync)

const syncState = computed(() => syncStateOf(state))

/** Nothing chosen and nothing kept: the first run, which asks where the ledger lives. */
const firstRun = computed(() => state.status !== 'opening' && state.choice === null && state.workbook === null)
const companyName = computed(() => state.workbook?.settings.companyName || null)

/** Toasts rise from the bottom, clear of the gesture bar in the installed app. */
const toaster = { ui: { viewport: 'bottom-[max(1rem,env(safe-area-inset-bottom))]' } }
</script>

<template>
  <UApp :toaster="toaster">
    <WelcomeScreen v-if="firstRun" />
    <AppShell v-else :navigation="navigation" :subtitle="companyName">
      <RouterView v-slot="{ Component }">
        <ScreenSkeleton v-if="screenLoading || !Component" />
        <component :is="Component" v-else />
      </RouterView>
      <template #sync="{ compact }">
        <LocalWorkbookStatus v-if="state.choice?.source === 'excel'" :compact="compact" />
        <SyncStatus
          v-else
          :state="syncState"
          :synced-at="state.syncedAt"
          :error-message="state.error ?? ''"
          :compact="compact"
          @sync="sync"
        />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
