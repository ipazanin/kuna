<script setup lang="ts">
import UEmpty from '@nuxt/ui/components/Empty.vue'

/** What a pack screen shows when the workbook turns the owner-pay module off. */
</script>

<template>
  <UEmpty
    icon="i-lucide-eye-off"
    title="The owner-pay module is off"
    description="This workbook sets owner_pay_module to FALSE, so owner pay counts as operating cost and this screen has nothing to show."
    :actions="[{ label: 'Open Settings', to: '/settings', color: 'neutral', variant: 'outline' }]"
    variant="naked"
    class="py-12"
  />
</template>
