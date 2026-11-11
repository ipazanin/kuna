<script setup lang="ts" generic="Value extends string | number">
import UButton from '@nuxt/ui/components/Button.vue'

import { formatCount } from '../money/moneyFormat'

/** A row of buttons that picks one of a few choices, the picked one solid and pressed. */
defineProps<{
  /**
   * Each choice, with the name a screen reader says where the label alone is too short, such as the whole month behind
   * Apr, and a count shown quieter after the label, such as how many rows the choice keeps.
   */
  options: readonly { readonly value: Value; readonly label: string; readonly ariaLabel?: string; readonly count?: number }[]
  /** What the choice is about, read out as the group's name. */
  label: string
  /** The choice whose write is running, which shows busy and stops the others being tapped meanwhile. */
  busy?: Value | null
}>()

const picked = defineModel<Value>({ required: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="label">
    <UButton
      v-for="option in options"
      :key="option.value"
      :label="option.label"
      :aria-label="option.ariaLabel"
      size="sm"
      color="neutral"
      :variant="option.value === picked ? 'solid' : 'outline'"
      :aria-pressed="option.value === picked"
      :loading="busy === option.value"
      :disabled="busy != null && busy !== option.value"
      :data-value="option.value"
      @click="picked = option.value"
    >
      <template v-if="option.count !== undefined" #trailing>
        <span class="figure font-normal opacity-70">{{ formatCount(option.count) }}</span>
      </template>
    </UButton>
  </div>
</template>
