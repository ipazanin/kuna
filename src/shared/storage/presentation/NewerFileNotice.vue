<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'

import { words } from './words'

/** Says that a newer version of Kuna saved the file on screen, which this version reads and never writes, and offers the reload that updates it. */
const emit = defineEmits<{
  reload: []
}>()
</script>

<template>
  <UAlert
    icon="i-lucide-triangle-alert"
    color="warning"
    variant="subtle"
    role="alert"
    :title="words.newerFile.title"
    :description="words.newerFile.description"
    :actions="[{ label: words.newerFile.reload, icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'outline', onClick: () => emit('reload') }]"
    data-testid="newer-file-notice"
  />
</template>
