<script setup lang="ts">
import AiAssistCard from '../../shared/ai/presentation/AiAssistCard.vue'
import { fetchKeysFromGoogle } from '../../shared/secrets/presentation/secretsStep'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import AppearanceCard from './AppearanceCard.vue'
import DeleteDataCard from './DeleteDataCard.vue'
import FilesHomeCard from './FilesHomeCard.vue'
import SyncCard from './SyncCard.vue'
import { words } from './words'

/** Kuna settings at `#/settings`, for every app on this device: the page's one sync while some app's file is on Drive, where new files go, the assistant, deleting data, then the look and the language. */
const sync = usePageSync()
const { someOnDrive, keysSync } = sync

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
      <AiAssistCard :keys-sync="keysSync" :fetch-keys="fetchKeys" />
      <DeleteDataCard />
      <AppearanceCard />
    </DashboardGrid>
  </section>
</template>
