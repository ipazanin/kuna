<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { signOutOfGoogle } from '../../shared/google/googleAuth'
import { autoSyncOn, switchAutoSync } from '../../shared/sync/infrastructure/autoSyncSwitch'
import SyncStepList from '../../shared/sync/presentation/SyncStepList.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import AppCard from '../../shared/ui/AppCard.vue'

/** Kuna settings: the steps of the last sync of this page, whether this device syncs by itself, and the one Google sign-in every file on Drive goes through. */
const sync = usePageSync()
const toast = useToast()
const signingOut = ref(false)

async function signOut(): Promise<void> {
  signingOut.value = true
  await signOutOfGoogle()
  signingOut.value = false
  toast.add({ title: 'Signed out of Google', description: 'The next sync asks Google to sign you in again.', icon: 'i-lucide-log-out', color: 'success' })
}
</script>

<template>
  <AppCard title="Sync" subtitle="Each sync reads the books on Drive, then runs every step their settings turn on, in order." data-testid="sync-card">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <SyncStepList :run="sync.run.value" @sync="sync.sync" />
      <USwitch
        :model-value="autoSyncOn"
        label="Sync as the app opens"
        description="On this device only. The app syncs as it opens and when you come back to it after ten minutes, while the Google sign-in is good. Off waits for your tap on Sync."
        data-testid="auto-sync"
        @update:model-value="switchAutoSync($event)"
      />
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-log-out" label="Sign out of Google" color="neutral" variant="outline" size="sm" :loading="signingOut" @click="signOut" />
      </div>
    </div>
  </AppCard>
</template>
