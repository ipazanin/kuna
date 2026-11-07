<script setup lang="ts">
import { computed } from 'vue'

import AiAssistCard from '../../shared/ai/presentation/AiAssistCard.vue'
import { fetchKeysFromGoogle } from '../../shared/secrets/presentation/secretsStep'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { installedApps } from '../routing/appRegistry'
import AppearanceCard from './AppearanceCard.vue'
import { assistLines } from './assistLines'
import DeleteDataCard from './DeleteDataCard.vue'
import FilesHomeCard from './FilesHomeCard.vue'
import SyncCard from './SyncCard.vue'
import { words } from './words'

/** Kuna settings at `#/settings`, for every app on this device: the page's one sync while some app's file is on Drive, where new files go, the assistant, deleting data, then the look and the language. */
const sync = usePageSync()
const { someOnDrive, keysSync } = sync

const assistApps = computed(() => assistLines(installedApps()))

function fetchKeys(): Promise<string | null> {
  return fetchKeysFromGoogle(sync.settled)
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.menu" :description="words.description" />
    <DashboardGrid>
      <SyncCard v-if="someOnDrive" />
      <FilesHomeCard />
      <AiAssistCard :apps="assistApps" :keys-sync="keysSync" :fetch-keys="fetchKeys" />
      <DeleteDataCard />
      <AppearanceCard />
    </DashboardGrid>
  </section>
</template>
