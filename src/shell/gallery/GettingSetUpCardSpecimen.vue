<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

import AskChatButton from '../../shared/ai/presentation/AskChatButton.vue'
import GettingSetUpCard from '../../shared/ui/GettingSetUpCard.vue'
import GallerySection from './GallerySection.vue'
</script>

<template>
  <GallerySection
    id="getting-set-up-card"
    title="GettingSetUpCard"
    description="What an app still lacks, with the screen that does each line. An action can settle a line where it stands, and the header's actions what settles several, such as Set up with the chat."
  >
    <GettingSetUpCard
      :lines="[
        { key: 'first-statement', text: 'Import your first bank statement', link: { label: 'Import', to: '/gallery' } },
        { key: 'first-rules', text: 'Kuna filed 31 of 48 rows. Teach it your biggest payees: Alpha Hosting, Beta Telecom and Gamma Rent.', link: { label: 'To review', to: '/gallery' } },
      ]"
    >
      <template #action="{ line }">
        <UButton v-if="line.key === 'first-statement'" label="Not now" color="neutral" variant="outline" size="sm" class="shrink-0" />
      </template>
      <template #actions><AskChatButton text="Set up with the chat" /></template>
    </GettingSetUpCard>
  </GallerySection>
</template>
