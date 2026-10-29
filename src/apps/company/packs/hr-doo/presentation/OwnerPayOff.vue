<script setup lang="ts">
import EmptyState from '../../../../../shared/ui/EmptyState.vue'

/** What a pack screen shows when the workbook turns the owner-pay module off. */
</script>

<template>
  <EmptyState
    icon="i-lucide-eye-off"
    title="The owner-pay module is off"
    description="This workbook sets owner_pay_module to FALSE, so owner pay counts as operating cost and this screen has nothing to show."
    :actions="[{ label: 'Open Settings', to: '/company/settings', color: 'neutral', variant: 'outline' }]"
  />
</template>
