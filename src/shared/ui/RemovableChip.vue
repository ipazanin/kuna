<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

/** A pill that names something picked, and removes it when pressed anywhere on it. It may lead with an icon. */
defineProps<{
  label: string
  /** The button's name for a screen reader, such as "Remove EXQ", which should hold the label. */
  removeLabel: string
  icon?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <UButton
    :label="label"
    :icon="icon"
    :loading="loading"
    trailing-icon="i-lucide-x"
    color="neutral"
    variant="subtle"
    size="xs"
    class="max-w-64 shrink-0 rounded-full"
    :aria-label="removeLabel"
    @click="emit('remove')"
  />
</template>
