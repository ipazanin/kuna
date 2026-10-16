<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRouter } from 'vue-router'
import UApp from '@nuxt/ui/components/App.vue'

import { bindFiltersToRouter } from './features/filters/application/filterStore'
import { useWorkbook } from './features/workbook/application/workbookStore'
import { syncStateOf } from './features/workbook/presentation/syncState'
import { SCREENS } from './shared/routing/screens'
import AppShell from './shared/ui/AppShell.vue'
import SyncStatus from './shared/ui/SyncStatus.vue'

const navigation = SCREENS.map((screen) => ({ to: screen.path, label: screen.title, icon: screen.icon }))

bindFiltersToRouter(useRouter())

const { state, open, sync } = useWorkbook()
void open()
const syncState = computed(() => syncStateOf(state))
</script>

<template>
  <UApp>
    <AppShell :navigation="navigation">
      <RouterView />
      <template #sync="{ compact }">
        <SyncStatus
          :state="syncState"
          :synced-at="state.syncedAt"
          :error-message="state.error ?? ''"
          :compact="compact"
          @sync="sync"
        />
      </template>
    </AppShell>
  </UApp>
</template>
