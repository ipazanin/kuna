<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import { words as sharedWords } from '../../shared/app/words'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { installedApps } from '../routing/appRegistry'
import { KUNA_SETTINGS_SCREEN } from '../routing/screens'
import { words as settingsWords } from '../settings/words'
import HomeAppCard from './HomeAppCard.vue'
import { words } from './words'

/** Kuna's home at `#/`: a card per installed app. Below 1024 px there is no menu, so Kuna settings is a link under the cards. */
const apps = installedApps()
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="sharedWords.allApps" :description="words.description" />
    <DashboardGrid data-testid="home-cards">
      <HomeAppCard v-for="app in apps" :key="app.id" :app="app" />
    </DashboardGrid>
    <UButton :to="KUNA_SETTINGS_SCREEN.path" :label="settingsWords.menu" icon="i-lucide-settings" color="neutral" variant="outline" class="self-start lg:hidden" data-testid="home-kuna-settings" />
  </section>
</template>
