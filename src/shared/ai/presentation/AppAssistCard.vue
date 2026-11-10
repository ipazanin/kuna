<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { KUNA_SETTINGS_ROUTE } from '../../secrets/presentation/pageSecrets'
import AppCard from '../../ui/AppCard.vue'
import { assistKeyKept, assistAllowedNow, providerInUse } from './aiProvider'
import { words } from './words'

/**
 * An app's Assistant tab: whether the chat asks before it reads and sends, and what it reads of the app. The yes for each AI
 * company lives in Kuna settings, which the card links. With no key it only says what the chat could do here.
 */
defineProps<{
  app: string
  /** The app's name, as the card says what the chat reads of it. */
  appName: string
}>()

const provider = computed(() => (assistKeyKept.value ? providerInUse() : null))
const allowed = computed(assistAllowedNow)
</script>

<template>
  <AppCard :title="words.card.title" :subtitle="provider === null ? words.appCard.chatOnly(appName) : words.appCard.uses(provider.name)" data-testid="app-assist-card" :data-app="app">
    <div v-if="provider === null" class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <UButton :to="KUNA_SETTINGS_ROUTE" :label="words.appCard.addKey" trailing-icon="i-lucide-arrow-right" color="neutral" variant="outline" size="sm" data-testid="assist-add-key" />
    </div>
    <div v-else class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <div class="flex flex-col items-start gap-1.5" data-testid="assist-allowed" :data-allowed="allowed">
        <p class="type-body">{{ allowed ? words.card.allowOn(provider.name) : words.card.allowOff(provider.name) }}</p>
        <UButton :to="KUNA_SETTINGS_ROUTE" :label="words.appCard.change" trailing-icon="i-lucide-arrow-right" color="neutral" variant="link" size="sm" class="px-0" data-testid="assist-allow-link" />
      </div>
      <div class="flex flex-col gap-1.5 border-t border-default pt-3" data-testid="assist-chat-reads">
        <p class="type-body text-highlighted">{{ words.appCard.chatTitle }}</p>
        <p class="type-caption">{{ words.consent.sends(words.appCard.chatSends(appName)) }}</p>
      </div>
    </div>
  </AppCard>
</template>
