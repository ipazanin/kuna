<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'

/** The records an app's file holds that its reading leaves out or doubts, one line each, so the person can fix them in the file. */
defineProps<{
  title: string
  lines: readonly string[]
}>()
</script>

<template>
  <UAlert icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="title">
    <template #description>
      <ul class="flex flex-col gap-0.5">
        <li v-for="line in lines" :key="line">{{ line }}</li>
      </ul>
    </template>
  </UAlert>
</template>
