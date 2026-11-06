<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { forgetKunaStart, kunaStart } from '../../shared/app/kunaStart'
import AppCard from '../../shared/ui/AppCard.vue'
import { words } from './words'

/** Kuna settings: where new files go, as the person said, and asking again. A file that exists stays where it is, and each app's Settings moves its own. */
const text = words.filesHome
const home = computed(() => kunaStart()?.home ?? null)
</script>

<template>
  <AppCard v-if="home" :title="text.title" data-testid="files-home-card">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <p class="text-sm text-toned" data-testid="files-home-answer">{{ home === 'drive' ? text.onDrive : text.inBrowser }}</p>
      <p class="text-xs text-muted">{{ text.askAgainNote }}</p>
      <UButton :label="text.askAgain" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="sm" class="self-start" data-testid="files-home-ask-again" @click="forgetKunaStart" />
    </div>
  </AppCard>
</template>
