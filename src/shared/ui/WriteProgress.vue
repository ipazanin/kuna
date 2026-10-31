<script setup lang="ts">
import UProgress from '@nuxt/ui/components/Progress.vue'

/** A thin moving bar for while the books are being saved. The caller places it, such as along the top of the page. */
defineProps<{
  active: boolean
  /** What the bar stands for in words, such as "Saving". */
  label: string
}>()
</script>

<template>
  <UProgress v-if="active" size="2xs" :aria-label="label" class="pointer-events-none" data-testid="write-progress" />
</template>
