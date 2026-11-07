<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../ui/AppCard.vue'
import type { ProviderPreset } from '../domain/providerPresets'
import { words } from './words'

/**
 * Asks inside the chat: before its first send, and again before reading an app that yes did not cover. It says what
 * leaves the device and what the company keeps. Always shows only where a visible switch can take it back.
 */
defineProps<{
  provider: ProviderPreset
  title: string
  /** What leaves this device, each sentence as the case at hand words it. */
  lines: readonly string[]
  offersAlways: boolean
}>()

const emit = defineEmits<{ allow: []; always: []; cancel: [] }>()

const allow = useTemplateRef<{ $el: HTMLElement }>('allow')
onMounted(() => allow.value?.$el.focus())
</script>

<template>
  <AppCard :title="title" heading="h3" data-testid="chat-consent">
    <div class="flex flex-col gap-3 px-4 pt-2 pb-4 sm:px-5">
      <div class="flex flex-col gap-1 type-caption">
        <p v-for="line in lines" :key="line">{{ line }}</p>
        <p>{{ words.retention[provider.id] }}</p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <UButton :label="words.consent.cancel" color="neutral" variant="ghost" size="sm" data-testid="chat-allow-cancel" @click="emit('cancel')" />
        <UButton v-if="offersAlways" :label="words.chat.allowAlways" color="neutral" variant="outline" size="sm" data-testid="chat-allow-always" @click="emit('always')" />
        <UButton ref="allow" :label="words.chat.allowInChat" size="sm" data-testid="chat-allow" @click="emit('allow')" />
      </div>
    </div>
  </AppCard>
</template>
