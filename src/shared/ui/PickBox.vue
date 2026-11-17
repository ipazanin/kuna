<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

/** The box before a row while rows are being picked: ticked when picked, dashed when the row cannot be picked. */
withDefaults(defineProps<{ picked: boolean; unpickable?: boolean }>(), { unpickable: false })
</script>

<template>
  <UIcon
    :name="unpickable ? 'i-lucide-square-dashed' : picked ? 'i-lucide-square-check' : 'i-lucide-square'"
    class="size-5 shrink-0"
    :class="picked ? 'text-primary' : 'text-muted'"
    aria-hidden="true"
  />
</template>
