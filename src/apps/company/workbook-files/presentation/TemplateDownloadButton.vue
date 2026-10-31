<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { downloadTemplate } from '../../workbook/presentation/workbookFiles'
import { words } from './words'

/** Downloads empty books in the template format, for someone who fills in a workbook before opening it here. */
const toast = useToast()
const downloading = ref(false)

async function download(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    await downloadTemplate()
  } catch (failure) {
    toast.add({ title: words.templateFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <UButton
    :label="words.downloadTemplate"
    icon="i-lucide-file-down"
    color="neutral"
    variant="link"
    size="sm"
    class="self-start px-0"
    :loading="downloading"
    data-testid="download-template"
    @click="download"
  />
</template>
