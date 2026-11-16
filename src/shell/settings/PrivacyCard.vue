<script setup lang="ts">
import AppCard from '../../shared/ui/AppCard.vue'
import { words } from './words'

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
</script>

<template>
  <AppCard :title="words.privacy.title">
    <p class="px-4 pt-3 pb-4 text-sm text-muted sm:px-5 sm:pb-5">
      {{ words.privacy.note }}
      <a :href="privacyPage" class="quiet-link inline-target">{{ words.privacy.link }}</a>
    </p>
  </AppCard>
</template>
