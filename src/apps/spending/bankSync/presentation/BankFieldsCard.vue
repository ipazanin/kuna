<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { BANK_SYNC_SCOPE, bankSyncPort } from './bankSyncPort'
import { words } from './words'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import AppCard from '../../../../shared/ui/AppCard.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** What each linked bank sends, as field names and counts with no value, for a person to copy when a bank needs a closer look. Closed until opened. */
const props = defineProps<{ applicationId: string }>()

const text = ref<string | null>(null)
const failure = ref<string | null>(null)
const busy = ref(false)
const copied = ref(false)
const copyFailed = ref(false)

async function read(): Promise<void> {
  failure.value = null
  busy.value = true
  try {
    const fields = await withGoogleAccess([BANK_SYNC_SCOPE], async () => (await bankSyncPort(props.applicationId)).bankFields())
    text.value = JSON.stringify(fields, null, 2)
  } catch (reason) {
    failure.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    busy.value = false
  }
}

async function copy(): Promise<void> {
  if (text.value === null) return
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    copyFailed.value = false
  } catch {
    copied.value = false
    copyFailed.value = true
  }
}
</script>

<template>
  <AppCard :title="words.fields.title" :subtitle="words.fields.subtitle" collapse-id="spending.bank-fields" start-collapsed data-testid="spending-bank-fields">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
      <div class="flex flex-wrap items-center gap-2">
        <UButton :label="words.fields.read" icon="i-lucide-scan-search" color="neutral" variant="outline" size="sm" :loading="busy" data-testid="spending-bank-fields-read" @click="read" />
        <UButton
          v-if="text !== null"
          :label="copied ? words.fields.copied : words.fields.copy"
          :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
          color="neutral"
          variant="ghost"
          size="sm"
          data-testid="spending-bank-fields-copy"
          @click="copy"
        />
      </div>
      <NoteLine v-if="failure !== null" tone="error" size="body">{{ failure }}</NoteLine>
      <NoteLine v-if="copyFailed" tone="error" size="body" data-testid="spending-bank-fields-copy-failed">{{ words.copyFailed }}</NoteLine>
      <pre v-if="text !== null" tabindex="0" class="max-h-64 overflow-y-auto rounded-control bg-elevated p-2 whitespace-pre-wrap wrap-anywhere type-caption" data-testid="spending-bank-fields-text">{{
        text
      }}</pre>
    </div>
  </AppCard>
</template>
