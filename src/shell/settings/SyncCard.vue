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
import { words } from './words'

/** Kuna settings: the steps of the last sync of this page, whether this device syncs by itself, and the one Google sign-in every file on Drive goes through. */
const sync = usePageSync()
const toast = useToast()
const signingOut = ref(false)

async function signOut(): Promise<void> {
  signingOut.value = true
  await signOutOfGoogle()
  signingOut.value = false
  toast.add({ title: words.sync.signedOut, description: words.sync.signedOutNote, icon: 'i-lucide-log-out', color: 'success' })
}
</script>

<template>
  <AppCard :title="words.sync.title" :subtitle="words.sync.subtitle" data-testid="sync-card">
    <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <SyncStepList :run="sync.run.value" @sync="sync.sync" />
      <USwitch :model-value="autoSyncOn" :label="words.sync.auto" :description="words.sync.autoNote" data-testid="auto-sync" @update:model-value="switchAutoSync($event)" />
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-log-out" :label="words.sync.signOut" color="neutral" variant="outline" size="sm" :loading="signingOut" @click="signOut" />
      </div>
    </div>
  </AppCard>
</template>
