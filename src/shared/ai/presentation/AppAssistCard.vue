<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { KUNA_SETTINGS_ROUTE } from '../../secrets/presentation/pageSecrets'
import AppCard from '../../ui/AppCard.vue'
import { assistOn, switchAssist } from '../application/assistSettings'
import { assistKeyKept, providerInUse } from './aiProvider'
import { words } from './words'

/**
 * An app's Assistant tab: whether it sends without asking, and what the chat reads of the app. It reads and writes the
 * choices in `assistSettings` and holds none. With no key it only says what the chat could do here.
 */
const props = defineProps<{
  app: string
  /** The app's name, as the card says what the chat reads of it. */
  appName: string
}>()

const provider = computed(() => (assistKeyKept.value ? providerInUse() : null))
const sendsFreely = computed(() => assistOn(props.app))
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="provider === null ? words.appCard.chatOnly(appName) : words.appCard.uses(provider.name)" data-testid="app-assist-card" :data-app="app">
    <div v-if="provider === null" class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <UButton :to="KUNA_SETTINGS_ROUTE" :label="words.appCard.addKey" trailing-icon="i-lucide-arrow-right" color="neutral" variant="outline" size="sm" data-testid="assist-add-key" />
    </div>
    <div v-else class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <USwitch :model-value="sendsFreely" :label="words.appCard.switch" :description="words.appCard.switchNote" :data-testid="`assist-switch-${app}`" @update:model-value="switchAssist(app, $event)" />
      <div class="flex flex-col gap-1.5 border-t border-default pt-3" data-testid="assist-chat-reads">
        <p class="type-body text-highlighted">{{ words.appCard.chatTitle }}</p>
        <p class="type-caption">{{ words.consent.sends(words.appCard.chatSends(appName)) }}</p>
      </div>
    </div>
  </AppCard>
</template>
