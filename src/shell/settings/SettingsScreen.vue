<script setup lang="ts">
import { computed } from 'vue'

import { usePageSync } from '../../shared/sync/presentation/pageSync'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import AppearanceCard from './AppearanceCard.vue'
import SyncCard from './SyncCard.vue'
import { words } from './words'

/** Kuna settings at `#/settings`, for every app on this device: the page's one sync while some app's file is on Drive, then the look and the language. */
const { groups } = usePageSync()
const someOnDrive = computed(() => groups.some((group) => group.store.state.choice?.source === 'drive'))
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.menu" :description="words.description" />
    <DashboardGrid>
      <SyncCard v-if="someOnDrive" />
      <AppearanceCard />
    </DashboardGrid>
  </section>
</template>
