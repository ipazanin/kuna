<script setup lang="ts">
import AiAssistCard from '../../shared/ai/presentation/AiAssistCard.vue'
import { usePageSync } from '../../shared/sync/presentation/pageSync'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { installedApps } from '../routing/appRegistry'
import AppearanceCard from './AppearanceCard.vue'
import DeleteKeysCard from './DeleteKeysCard.vue'
import FilesHomeCard from './FilesHomeCard.vue'
import SyncCard from './SyncCard.vue'
import { words } from './words'

/** Kuna settings at `#/settings`, for every app on this device: the page's one sync while some app's file is on Drive, where new files go, the assistant, the keys in the Google account, then the look and the language. */
const { someOnDrive } = usePageSync()
const assistApps = installedApps().flatMap((app) => (app.assist === undefined ? [] : [{ id: app.id, name: app.name, assist: app.assist }]))
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.menu" :description="words.description" />
    <DashboardGrid>
      <SyncCard v-if="someOnDrive" />
      <FilesHomeCard />
      <AiAssistCard :apps="assistApps" :on-drive="someOnDrive" />
      <DeleteKeysCard />
      <AppearanceCard />
    </DashboardGrid>
  </section>
</template>
