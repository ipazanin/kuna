<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckboxGroup from '@nuxt/ui/components/CheckboxGroup.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { answerKunaStart } from '../../shared/app/kunaStart'
import type { FilesHome } from '../../shared/app/kunaStart'
import AppCard from '../../shared/ui/AppCard.vue'
import { installedApps } from '../routing/appRegistry'
import { words } from './words'

/** The one question a new person answers on the home, once: which apps, and where all their files live. Nothing is made here, and no app asks again. */
const text = words.welcome
const apps = installedApps()

const APP_CHOICES = apps.map((app) => ({ label: app.name, description: app.homeCard.purpose, value: app.id }))
const HOME_CHOICES: { label: string; description: string; value: FilesHome }[] = [
  { label: text.drive, description: text.driveNote, value: 'drive' },
  { label: text.browser, description: text.browserNote, value: 'browser' },
]

const chosenApps = ref<string[]>([])
const home = ref<FilesHome>('drive')

const orderLines = computed(() =>
  apps.flatMap((app) => (app.setUpOrder !== undefined && chosenApps.value.includes(app.id) && chosenApps.value.includes(app.setUpOrder.after) ? [app.setUpOrder.why] : [])),
)

function answer(): void {
  answerKunaStart({ apps: chosenApps.value, home: home.value })
}
</script>

<template>
  <AppCard :title="text.title" heading="h1" class="max-w-2xl" data-testid="kuna-welcome">
    <template #title>
      <span data-testid="screen-title" tabindex="-1" class="screen-title">{{ text.title }}</span>
    </template>
    <div class="flex flex-col gap-5 px-4 pt-4 pb-5 sm:px-5">
      <UCheckboxGroup v-model="chosenApps" :items="APP_CHOICES" :legend="text.which" variant="card" :ui="{ legend: 'type-label mb-2', fieldset: 'gap-2' }" data-testid="kuna-welcome-apps" />
      <p v-for="line in orderLines" :key="line" class="type-caption" data-testid="kuna-welcome-order">{{ line }}</p>
      <URadioGroup v-model="home" :items="HOME_CHOICES" :legend="text.where" variant="card" :ui="{ legend: 'type-label mb-2', fieldset: 'gap-2' }" data-testid="kuna-welcome-home" />
      <div class="flex justify-end border-t border-default pt-4">
        <UButton :label="text.continue" trailing-icon="i-lucide-arrow-right" :disabled="chosenApps.length === 0" data-testid="kuna-welcome-continue" @click="answer" />
      </div>
    </div>
  </AppCard>
</template>
