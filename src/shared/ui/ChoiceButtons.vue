<script setup lang="ts" generic="Value extends string | number">
import UButton from '@nuxt/ui/components/Button.vue'

/** A row of buttons that picks one of a few choices, the picked one solid and pressed. */
defineProps<{
  options: readonly { readonly value: Value; readonly label: string }[]
  /** What the choice is about, read out as the group's name. */
  label: string
}>()

const picked = defineModel<Value>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="label">
    <UButton
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      size="sm"
      color="neutral"
      :variant="option.value === picked ? 'solid' : 'outline'"
      :aria-pressed="option.value === picked"
      @click="picked = option.value"
    />
  </div>
</template>
