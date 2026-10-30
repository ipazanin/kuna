<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

/** An app's icon on a tile in the app's own colour, so each app is told apart at a glance. */
withDefaults(
  defineProps<{
    /** A Lucide icon name such as `i-lucide-landmark`. */
    icon: string
    /** The custom property of the colour, such as `--app-loans`. */
    colour: `--${string}`
    size?: 'small' | 'medium' | 'large'
  }>(),
  { size: 'small' },
)

const TILE = { small: 'size-6', medium: 'size-8', large: 'size-9' }
const GLYPH = { small: 'size-4', medium: 'size-4.5', large: 'size-5' }
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-control"
    :class="TILE[size]"
    :style="{ color: `var(${colour})`, backgroundColor: `color-mix(in srgb, var(${colour}) 14%, transparent)` }"
    aria-hidden="true"
    data-testid="app-mark"
  >
    <UIcon :name="icon" :class="GLYPH[size]" />
  </span>
</template>
