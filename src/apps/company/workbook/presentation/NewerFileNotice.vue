<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { useWorkbook } from '../application/workbookStore'
import { savedByNewerApp } from '../../../../shared/storage/infrastructure/documentFormat'
import { installedSchema } from '../infrastructure/documentStorePorts'

/** Says so while the file on screen was saved by a newer version of Kuna, which this app reads and never writes. */
const { state } = useWorkbook()

const newer = computed(() => state.snapshot !== null && savedByNewerApp(state.snapshot.document, installedSchema()))
</script>

<template>
  <UAlert
    v-if="newer"
    icon="i-lucide-triangle-alert"
    color="warning"
    variant="subtle"
    title="A newer version of Kuna saved this file"
    description="Reload to update before you change anything. Until then the app shows the file and saves nothing to it."
    data-testid="newer-file-notice"
  />
</template>
