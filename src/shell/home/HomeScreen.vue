<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { kunaStart } from '../../shared/app/kunaStart'
import { words as sharedWords } from '../../shared/app/words'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { installedApps } from '../routing/appRegistry'
import { KUNA_SETTINGS_SCREEN, NET_WORTH_SCREEN } from '../routing/screens'
import { words as settingsWords } from '../settings/words'
import HomeAppCard from './HomeAppCard.vue'
import KunaWelcome from './KunaWelcome.vue'
import { words } from './words'

/**
 * Kuna's home at `#/`: a card per installed app, and on a device with nothing set up and no answer yet the one welcome instead. An app the
 * person left out of their answer waits under the others until it has a file. Below 1024 px there is no menu, so Net worth is a link above the
 * cards while some app has a file to add up, and Kuna settings one under them.
 */
const apps = installedApps()
const welcomes = computed(() => kunaStart() === null && apps.every((app) => app.firstRun()))
const left = computed(() => {
  const start = kunaStart()
  return start === null ? [] : apps.filter((app) => app.firstRun() && !start.apps.includes(app.id))
})
const used = computed(() => apps.filter((app) => !left.value.includes(app)))
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="sharedWords.allApps" :description="words.description" />
    <KunaWelcome v-if="welcomes" />
    <template v-else>
      <UButton
        v-if="used.some((app) => !app.firstRun())"
        :to="NET_WORTH_SCREEN.path"
        :label="NET_WORTH_SCREEN.title"
        :icon="NET_WORTH_SCREEN.icon"
        color="neutral"
        variant="outline"
        class="self-start lg:hidden"
        data-testid="home-overview"
      />
      <DashboardGrid data-testid="home-cards">
        <HomeAppCard v-for="app in used" :key="app.id" :app="app" />
      </DashboardGrid>
      <template v-if="left.length > 0">
        <h2 class="type-label" data-testid="home-other-apps">{{ words.otherApps }}</h2>
        <DashboardGrid data-testid="home-other-cards">
          <HomeAppCard v-for="app in left" :key="app.id" :app="app" />
        </DashboardGrid>
      </template>
    </template>
    <UButton :to="KUNA_SETTINGS_SCREEN.path" :label="settingsWords.menu" icon="i-lucide-settings" color="neutral" variant="outline" class="self-start lg:hidden" data-testid="home-kuna-settings" />
  </section>
</template>
