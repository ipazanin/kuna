<script setup lang="ts">
import { ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import GallerySection from './GallerySection.vue'
import BankNameField from '../../shared/ui/BankNameField.vue'
import FormGrid from '../../shared/ui/FormGrid.vue'

const BANKS = ['OTP banka', 'Revolut', 'Privredna banka Zagreb']

const blank = ref('')
const known = ref('Revolut')
const fresh = ref('Erste')
</script>

<template>
  <GallerySection
    id="bank-name-field"
    title="BankNameField"
    description="A bank's name as typed, with the banks the book already names offered as it is typed. A name no account has is offered as a new bank, and a blank field names no bank."
  >
    <FormGrid>
      <UFormField label="Bank, blank">
        <BankNameField v-model="blank" :banks="BANKS" data-testid="gallery-bank-name-blank" />
      </UFormField>
      <UFormField label="Bank, a known one">
        <BankNameField v-model="known" :banks="BANKS" />
      </UFormField>
      <UFormField label="Bank, a new one">
        <BankNameField v-model="fresh" :banks="BANKS" />
      </UFormField>
    </FormGrid>
  </GallerySection>
</template>
