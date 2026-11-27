<script setup lang="ts">
import { ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import GallerySection from './GallerySection.vue'
import FormGrid from '../../shared/ui/FormGrid.vue'
import IbanTagsField from '../../shared/ui/IbanTagsField.vue'

const none = ref<string[]>([])
const two = ref<string[]>(['HR1210010051863000160', 'HR6212345670000000001'])
const noted = ref<string[]>(['HR1210010051863000160', 'HR6212345670000000001'])
const ENTRIES_FROM: Record<string, string> = { HR1210010051863000160: '3 entries', HR6212345670000000001: '1 entry' }

function entriesFrom(iban: string): string | null {
  return ENTRIES_FROM[iban] ?? null
}
</script>

<template>
  <GallerySection
    id="iban-tags-field"
    title="IbanTagsField"
    description="A list of IBANs, each a tag with its own remove button. A comma, Enter or leaving the field adds what was typed, a pasted list splits at its commas, and each IBAN is kept once without its spaces. A note may follow an IBAN, such as how many entries come from it."
  >
    <FormGrid>
      <UFormField label="IBANs, none yet">
        <IbanTagsField v-model="none" class="w-full" data-testid="gallery-iban-tags-none" />
      </UFormField>
      <UFormField label="IBANs, two">
        <IbanTagsField v-model="two" class="w-full" />
      </UFormField>
      <UFormField label="IBANs, each with a note">
        <IbanTagsField v-model="noted" :note="entriesFrom" class="w-full" />
      </UFormField>
    </FormGrid>
  </GallerySection>
</template>
