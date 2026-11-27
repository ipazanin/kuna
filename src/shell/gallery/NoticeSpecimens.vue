<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { TONE_ICONS } from '../../shared/ui/toneText'
import GallerySection from './GallerySection.vue'

const toast = useToast()

function showWarning(): void {
  toast.add({ title: 'Added, not linked', description: 'The row stays added. Link it again from its row.', icon: TONE_ICONS.warning, color: 'warning' })
}

function showError(): void {
  toast.add({ title: 'Not saved', description: 'Google Drive did not answer, so check your connection and try again.', icon: TONE_ICONS.error, color: 'error' })
}
</script>

<template>
  <GallerySection
    id="notices"
    title="Notices"
    description="A subtle UAlert in a card or a dialog, and a toast after a write. Each takes its tone's icon from TONE_ICONS: the triangle for a warning, the circle for an error."
  >
    <div class="flex max-w-prose flex-col gap-3">
      <UAlert icon="i-lucide-info" color="neutral" variant="subtle" title="Nothing to do" description="Prices for funds update once a day." />
      <UAlert :icon="TONE_ICONS.info" color="info" variant="subtle" title="Waiting on you" description="Two rows wait for a category." />
      <UAlert :icon="TONE_ICONS.warning" color="warning" variant="subtle" title="May be wrong" description="The bank and the app differ by 10.00 on health insurance." />
      <UAlert
        :icon="TONE_ICONS.error"
        color="error"
        variant="subtle"
        title="The file could not be deleted"
        description="Google Drive did not answer. Nothing else was removed."
        data-testid="gallery-error-alert"
      />
    </div>
    <div class="flex flex-wrap gap-2">
      <UButton label="Show a warning toast" color="neutral" variant="outline" @click="showWarning" />
      <UButton label="Show an error toast" color="neutral" variant="outline" data-testid="gallery-error-toast" @click="showError" />
    </div>
  </GallerySection>
</template>
