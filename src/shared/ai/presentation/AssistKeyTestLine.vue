<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

/** What the last test of a key said, with an icon as well as the colour. */
defineProps<{
  line: string
  works: boolean
}>()
</script>

<template>
  <p role="status" class="flex items-start gap-1.5 type-body" :class="works ? 'text-success' : 'text-error'" data-testid="assist-key-test-result">
    <UIcon :name="works ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
    {{ line }}
  </p>
</template>
