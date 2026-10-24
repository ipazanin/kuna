<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import WelcomeScreen from './features/data-source/presentation/WelcomeScreen.vue'
import LocalWorkbookStatus from './features/excel/presentation/LocalWorkbookStatus.vue'
import { useStatementSync } from './features/imports/presentation/useStatementSync'
import { bindFiltersToRouter } from './features/filters/application/filterStore'
import { shownPack } from './features/packs/packContribution'
import { useSettings } from './features/settings/application/useSettings'
import { startAutoSync } from './features/workbook/application/autoSync'
import { useWorkbook } from './features/workbook/application/workbookStore'
import type { RedirectReturn } from './shared/google/googleRedirect'
import { needsReview } from './features/workbook/domain/needsReview'
import { syncStateOf } from './features/workbook/presentation/syncState'
import { useGoogleReturn } from './features/workbook/presentation/useGoogleReturn'
import { screenLoading } from './shared/routing/router'
import { screensWith } from './shared/routing/screens'
import AppShell from './shared/ui/AppShell.vue'
import ScreenSkeleton from './shared/ui/ScreenSkeleton.vue'
import SyncStatus from './shared/ui/SyncStatus.vue'
import UpdatePrompt from './shared/ui/UpdatePrompt.vue'

const props = defineProps<{
  /** Google's answer to a redirect sign-in, taken from the address before the router started. */
  googleReturn: RedirectReturn | null
}>()

const settings = useSettings()
const store = useWorkbook()
const { state } = store
const statements = useStatementSync()

/** Review's menu item counts every row that waits, whatever the filters, since the queue has no period. */
const rowsToReview = computed(() => state.workbook?.transactions.filter(needsReview).length ?? 0)
const navigation = computed(() =>
  screensWith(shownPack(settings.value).screens).map((screen) => ({
    to: screen.path,
    label: screen.title,
    icon: screen.icon,
    ...(screen.setApart ? { setApart: true as const } : {}),
    ...(screen.path === '/review' ? { count: rowsToReview.value } : {}),
  })),
)

bindFiltersToRouter(useRouter())
useGoogleReturn(props.googleReturn, statements.syncByHand)
const stopAutoSync = startAutoSync({
  store,
  sync: statements.sync,
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

/** A sync reads the file on Drive, then looks for new statements there, and the control says which. */
const syncState = computed(() => (statements.state.step === null ? syncStateOf(state) : 'syncing'))
const syncStep = computed(() => statements.state.step ?? { kind: 'reading' as const })

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
        <LocalWorkbookStatus v-if="state.choice?.source === 'browser'" :compact="compact" />
        <SyncStatus
          v-else
          :state="syncState"
          :synced-at="state.syncedAt"
          :error-message="state.error ?? ''"
          :compact="compact"
          :step="syncStep"
          @sync="statements.syncByHand"
        />
      </template>
    </AppShell>
    <UpdatePrompt />
  </UApp>
</template>
