<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckboxGroup from '@nuxt/ui/components/CheckboxGroup.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import AssistSetUp from '../../shared/ai/presentation/AssistSetUp.vue'
import { assistKeyKept } from '../../shared/ai/presentation/aiProvider'
import { words as assistWords } from '../../shared/ai/presentation/words'
import { answerKunaStart } from '../../shared/app/kunaStart'
import type { FilesHome } from '../../shared/app/kunaStart'
import AppCard from '../../shared/ui/AppCard.vue'
import { installedApps } from '../routing/appRegistry'
import { words } from './words'

/**
 * The questions a new person answers on the home, once: which apps, where all their files live, and whether to set up the AI assistant.
 * Nothing is made here, and no app asks again. Only a yes on the assistant adds a step, in this same card, and the answer is given when that step ends.
 */
const text = words.welcome
const apps = installedApps()

const APP_CHOICES = apps.map((app) => ({ label: app.name, description: app.homeCard.purpose, value: app.id }))
const HOME_CHOICES: { label: string; description: string; value: FilesHome }[] = [
  { label: text.drive, description: text.driveNote, value: 'drive' },
  { label: text.browser, description: text.browserNote, value: 'browser' },
]
const AI_CHOICES = [
  { label: text.aiYes, value: 'yes' },
  { label: text.aiLater, value: 'later' },
]

const chosenApps = ref<string[]>([])
const home = ref<FilesHome>('drive')
const aiChoice = ref('later')
const settingUpAi = ref(false)

const orderLines = computed(() =>
  apps.flatMap((app) => (app.setUpOrder !== undefined && chosenApps.value.includes(app.id) && chosenApps.value.includes(app.setUpOrder.after) ? [app.setUpOrder.why] : [])),
)

const screenTitle = useTemplateRef<HTMLElement>('screenTitle')

/** The card's body changes under the person, so focus goes to its new title, as it does on a new screen. */
function showKeyStep(shows: boolean): void {
  settingUpAi.value = shows
  void nextTick(() => screenTitle.value?.focus())
}

function answer(): void {
  answerKunaStart({ apps: chosenApps.value, home: home.value })
}

function goOn(): void {
  if (aiChoice.value === 'yes' && !assistKeyKept.value) showKeyStep(true)
  else answer()
}
</script>

<template>
  <AppCard :title="settingUpAi ? assistWords.card.title : text.title" heading="h1" class="max-w-2xl" data-testid="kuna-welcome">
    <template #title>
      <span ref="screenTitle" data-testid="screen-title" tabindex="-1" class="screen-title">{{ settingUpAi ? assistWords.card.title : text.title }}</span>
    </template>
    <AssistSetUp v-if="settingUpAi" @back="showKeyStep(false)" @done="answer" />
    <div v-else class="flex flex-col gap-5 px-4 pt-4 pb-5 sm:px-5">
      <UCheckboxGroup v-model="chosenApps" :items="APP_CHOICES" :legend="text.which" variant="card" :ui="{ legend: 'type-label mb-2', fieldset: 'gap-2' }" data-testid="kuna-welcome-apps" />
      <p v-for="line in orderLines" :key="line" class="type-caption" data-testid="kuna-welcome-order">{{ line }}</p>
      <URadioGroup v-model="home" :items="HOME_CHOICES" :legend="text.where" variant="card" :ui="{ legend: 'type-label mb-2', fieldset: 'gap-2' }" data-testid="kuna-welcome-home" />
      <div v-if="!assistKeyKept" class="flex flex-col gap-2">
        <URadioGroup v-model="aiChoice" :items="AI_CHOICES" :legend="text.ai" orientation="horizontal" :ui="{ legend: 'type-label mb-2', label: 'min-w-11' }" data-testid="kuna-welcome-ai" />
        <p class="type-caption">{{ text.aiNote }}</p>
      </div>
      <div class="flex justify-end border-t border-default pt-4">
        <UButton :label="text.continue" trailing-icon="i-lucide-arrow-right" :disabled="chosenApps.length === 0" data-testid="kuna-welcome-continue" @click="goOn" />
      </div>
    </div>
  </AppCard>
</template>
