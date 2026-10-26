<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'

/** The mark a phone's tap chose, with the button that opens its rows. */
defineProps<{
  /** The mark, such as "Salary net, March 2026". */
  label: string
}>()

defineEmits<{
  view: []
}>()
</script>

<template>
  <div class="flex items-center gap-3 border-t border-default px-4 py-2" data-testid="chart-drill">
    <p class="min-w-0 flex-1 truncate text-xs text-toned">{{ label }}</p>
    <UButton label="View rows" icon="i-lucide-list" size="sm" color="neutral" variant="outline" @click="$emit('view')" />
  </div>
</template>
