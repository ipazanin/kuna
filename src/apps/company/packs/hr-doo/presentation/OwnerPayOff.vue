<script setup lang="ts">
import EmptyState from '../../../../../shared/ui/EmptyState.vue'
import { words } from './words'

/** What a pack screen shows when the workbook turns the owner-pay module off. */
</script>

<template>
  <EmptyState
    icon="i-lucide-eye-off"
    :title="words.ownerPayOff.title"
    :description="words.ownerPayOff.description"
    :actions="[{ label: words.ownerPayOff.openSettings, to: '/company/settings', color: 'neutral', variant: 'outline' }]"
  />
</template>
