<script setup lang="ts">
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'

/** A dashed place to drop a file on, or to tap to choose one. Choosing again starts from no file, so the same file can be picked twice. */
const file = defineModel<File | null>({ required: true })

defineProps<{
  label: string
  description: string
  /** The file types offered when choosing, such as `.xlsx,.csv`. */
  accept: string
  icon?: string
}>()
</script>

<template>
  <UFileUpload
    v-model="file"
    :accept="accept"
    :preview="false"
    reset
    :icon="icon ?? 'i-lucide-file-up'"
    :label="label"
    :description="description"
    color="neutral"
    class="w-full"
    :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
  />
</template>
