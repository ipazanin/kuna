<script setup lang="ts">
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import { autoSyncOn, switchAutoSync } from '../infrastructure/autoSyncSwitch'
import SyncStepList from './SyncStepList.vue'
import { useSync } from './useSync'

/** Settings, This device: the steps of the last sync of this page, and whether this device syncs by itself. */
const sync = useSync()
</script>

<template>
  <AppCard title="Sync" subtitle="Each sync reads the books, then runs every step the settings turn on, in order." data-testid="sync-card">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <SyncStepList :run="sync.run.value" @sync="sync.sync" />
      <USwitch
        :model-value="autoSyncOn"
        label="Sync as the app opens"
        description="On this device only. The app syncs as it opens and when you come back to it after ten minutes, while the Google sign-in is good. Off waits for your tap on Sync."
        data-testid="auto-sync"
        @update:model-value="switchAutoSync($event)"
      />
    </div>
  </AppCard>
</template>
