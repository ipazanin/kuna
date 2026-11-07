<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import UButton from '@nuxt/ui/components/Button.vue'

import { answerKunaStart, forgetKunaStart, kunaStart } from '../../shared/app/kunaStart'
import AppCard from '../../shared/ui/AppCard.vue'
import { words } from './words'

/** Kuna settings: where new files go, as the person said, and asking again. A file that exists stays where it is, and each app's Settings moves its own. */
const text = words.filesHome
const home = computed(() => kunaStart()?.home ?? null)
const toast = useToast()

/** How long the toast stays, so there is time to reach Undo. */
const UNDO_TOAST_DURATION = 10_000

function askAgain(): void {
  const answer = kunaStart()
  forgetKunaStart()
  if (answer === null) return
  toast.add({
    title: text.askedAgain,
    icon: 'i-lucide-rotate-ccw',
    color: 'neutral',
    duration: UNDO_TOAST_DURATION,
    actions: [{ label: text.undo, icon: 'i-lucide-undo-2', color: 'neutral', variant: 'outline', onClick: () => answerKunaStart(answer) }],
  })
}
</script>

<template>
  <AppCard v-if="home" :title="text.title" data-testid="files-home-card">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <p class="type-body" data-testid="files-home-answer">{{ home === 'drive' ? text.onDrive : text.inBrowser }}</p>
      <p class="type-caption">{{ text.askAgainNote }}</p>
      <UButton :label="text.askAgain" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" size="sm" class="self-start" data-testid="files-home-ask-again" @click="askAgain" />
    </div>
  </AppCard>
</template>
